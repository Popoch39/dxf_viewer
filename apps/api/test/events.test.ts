import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";

import { app } from "../src/app";
import { statusChannel } from "../src/parsing/events";
import { startParsingWorker } from "../src/parsing/worker";
import { redis } from "../src/redis";
import { signedUpCookie } from "./session";

const api = treaty(app);

const worker = startParsingWorker();

const FIXTURE = new URL(
  "../../../packages/dxf/test/fixtures/r2000-with-blocks.dxf",
  import.meta.url,
);

let source = "";

beforeAll(async () => {
  source = await Bun.file(FIXTURE).text();
});

afterAll(async () => {
  await worker.close();
});

/** Creates a Dessin and uploads `body` through its presigned URL. */
async function uploadedDrawing(cookie: string, body: string) {
  const { data, error } = await api.drawings.post(
    { name: "Plan", filename: "plan.dxf", sizeBytes: body.length },
    { headers: { cookie } },
  );

  if (data === null) {
    throw new Error(`expected a created drawing, got ${JSON.stringify(error?.value)}`);
  }

  await fetch(data.uploadUrl, { method: "PUT", body });

  return data.drawing;
}

/** Opens the status stream of a Dessin; aborting `controller` disconnects it. */
async function openEvents(cookie: string, id: string, controller: AbortController) {
  const { data, error } = await api
    .drawings({ id })
    .events.get({ headers: { cookie }, fetch: { signal: controller.signal } });

  if (data === null) {
    throw new Error(`expected a status stream, got ${JSON.stringify(error?.value)}`);
  }

  return data;
}

const SETTLED = new Set(["ready", "failed"]);

/** Every event of the stream, up to the end of the Parsing. */
async function eventsUntilSettled(stream: Awaited<ReturnType<typeof openEvents>>) {
  const events = [];

  for await (const event of stream) {
    events.push(event.data);

    if (SETTLED.has(event.data.status)) {
      break;
    }
  }

  return events;
}

async function subscriberCount(id: string): Promise<number> {
  const reply: unknown = await redis.send("PUBSUB", ["NUMSUB", statusChannel(id)]);

  return Array.isArray(reply) ? Number(reply[1]) : Number.NaN;
}

/** Polls until the stream of the Dessin has no Redis subscriber left. */
async function unsubscribed(id: string, deadline = Date.now() + 2000): Promise<boolean> {
  if ((await subscriberCount(id)) === 0) {
    return true;
  }

  if (Date.now() > deadline) {
    return false;
  }

  await Bun.sleep(20);

  return unsubscribed(id, deadline);
}

describe("GET /drawings/:id/events", () => {
  it("streams the current Statut, then every change of the Parsing up to ready", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);
    const controller = new AbortController();
    const stream = await openEvents(cookie, drawing.id, controller);

    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });
    const events = await eventsUntilSettled(stream);
    controller.abort();

    expect(events).toEqual([
      { status: "awaiting_upload", error: null },
      { status: "queued", error: null },
      { status: "parsing", error: null },
      { status: "ready", error: null },
    ]);
  });

  it("streams failed with the error when the file is not a DXF", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, "this is not a drawing");
    const controller = new AbortController();
    const stream = await openEvents(cookie, drawing.id, controller);

    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });
    const events = await eventsUntilSettled(stream);
    controller.abort();

    expect(events.at(-1)?.status).toBe("failed");
    expect(events.at(-1)?.error).toStartWith("The file is not a valid DXF");
  });

  it("drops its Redis subscription when the client disconnects", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);
    const controller = new AbortController();
    const stream = await openEvents(cookie, drawing.id, controller);

    await stream.next();

    expect(await subscriberCount(drawing.id)).toBe(1);

    controller.abort();

    expect(await unsubscribed(drawing.id)).toBe(true);
  });

  it("answers 404 to another user", async () => {
    const owner = await signedUpCookie(app.handle);
    const intruder = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(owner, source);

    const { error } = await api
      .drawings({ id: drawing.id })
      .events.get({ headers: { cookie: intruder } });

    expect(error?.status).toBe(404);
    expect(error?.value).toMatchObject({ error: { code: "DRAWING_NOT_FOUND" } });
    expect(await subscriberCount(drawing.id)).toBe(0);
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings({ id: crypto.randomUUID() }).events.get();

    expect(error?.status).toBe(401);
  });
});
