import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { parseDxf } from "@repo/dxf";

import { app } from "../src/app";
import { env } from "../src/env";
import { startParsingWorker } from "../src/parsing/worker";
import { signedUpCookie } from "./session";

const api = treaty(app);

const worker = startParsingWorker();

// A real drawing, with layers and blocks, shared with the tests of the DXF module.
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

/**
 * Creates a Dessin and uploads `body` through its presigned URL. The declared
 * size stays within the limit, as a client could lie about it.
 */
async function uploadedDrawing(cookie: string, body: string) {
  const sizeBytes = Math.min(Math.max(body.length, 1), env.maxUploadBytes);

  const { data, error } = await api.drawings.post(
    { name: "Plan", filename: "plan.dxf", sizeBytes },
    { headers: { cookie } },
  );

  if (data === null) {
    throw new Error(`expected a created drawing, got ${JSON.stringify(error?.value)}`);
  }

  if (body !== "") {
    const upload = await fetch(data.uploadUrl, { method: "PUT", body });

    expect(upload.status).toBe(200);
  }

  return data.drawing;
}

const SETTLED = new Set(["ready", "failed"]);

/** Polls the Dessin until its Parsing is over. */
async function settledDrawing(cookie: string, id: string, deadline = Date.now() + 10_000) {
  const { data } = await api.drawings({ id }).get({ headers: { cookie } });

  if (data !== null && SETTLED.has(data.status)) {
    return data;
  }

  if (Date.now() > deadline) {
    throw new Error(`drawing ${id} was not parsed within 10 s`);
  }

  await Bun.sleep(50);

  return settledDrawing(cookie, id, deadline);
}

describe("POST /drawings/:id/complete", () => {
  it("queues the Parsing, which makes the drawing ready with links to both files", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);

    const { data, status } = await api
      .drawings({ id: drawing.id })
      .complete.post(undefined, { headers: { cookie } });

    expect(status).toBe(202);
    expect(data?.status).toBe("queued");

    const ready = await settledDrawing(cookie, drawing.id);
    const expected = parseDxf(source);

    expect(ready).toMatchObject({
      status: "ready",
      error: null,
      sizeBytes: source.length,
      dxfVersion: expected.meta.dxfVersion,
      units: expected.meta.units,
      extent: expected.meta.extent,
      layers: expected.layers,
      entityCounts: expected.meta.entityCounts,
    });
    expect(ready.parsedAt).toBeInstanceOf(Date);

    if (ready.parsedUrl === null || ready.sourceUrl === null) {
      throw new Error("expected links to the current revision");
    }

    const parsed = await fetch(ready.parsedUrl);
    const original = await fetch(ready.sourceUrl);

    expect(await parsed.json()).toEqual(expected);
    expect(await original.text()).toBe(source);
  });

  it("gives download links that expire within 15 minutes", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);
    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });

    const { parsedUrl, sourceUrl } = await settledDrawing(cookie, drawing.id);

    for (const url of [parsedUrl, sourceUrl]) {
      const expiresIn = Number(new URL(url ?? "").searchParams.get("X-Amz-Expires"));

      expect(expiresIn).toBeGreaterThan(0);
      expect(expiresIn).toBeLessThanOrEqual(15 * 60);
    }
  });

  it("marks the drawing failed with a readable error when the file is not a DXF", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, "this is not a drawing");

    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });

    const failed = await settledDrawing(cookie, drawing.id);

    expect(failed).toMatchObject({ status: "failed", parsedUrl: null, sourceUrl: null });
    expect(failed.error).toStartWith("The file is not a valid DXF");
  });

  it("refuses to complete an upload whose file is missing from the storage", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, "");

    const { error } = await api
      .drawings({ id: drawing.id })
      .complete.post(undefined, { headers: { cookie } });

    const { data } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(error?.status).toBe(409);
    expect(error?.value).toEqual({
      error: { code: "SOURCE_FILE_MISSING", message: expect.any(String) },
    });
    expect(data?.status).toBe("awaiting_upload");
  });

  it("refuses to complete an upload whose file exceeds the size limit", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, "0".repeat(env.maxUploadBytes + 1));

    const { error } = await api
      .drawings({ id: drawing.id })
      .complete.post(undefined, { headers: { cookie } });

    const { data } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(error?.status).toBe(413);
    expect(error?.value).toEqual({
      error: { code: "SOURCE_FILE_TOO_LARGE", message: expect.any(String) },
    });
    expect(data?.status).toBe("awaiting_upload");
  });

  it("refuses to complete an upload twice", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);
    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });

    const { error } = await api
      .drawings({ id: drawing.id })
      .complete.post(undefined, { headers: { cookie } });

    expect(error?.status).toBe(409);
    expect(error?.value).toMatchObject({ error: { code: "NO_PENDING_UPLOAD" } });
  });

  it("answers 404 to another user, and does not queue anything", async () => {
    const owner = await signedUpCookie(app.handle);
    const intruder = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(owner, source);

    const { error } = await api
      .drawings({ id: drawing.id })
      .complete.post(undefined, { headers: { cookie: intruder } });

    const { data } = await api.drawings({ id: drawing.id }).get({ headers: { cookie: owner } });

    expect(error?.status).toBe(404);
    expect(error?.value).toMatchObject({ error: { code: "DRAWING_NOT_FOUND" } });
    expect(data?.status).toBe("awaiting_upload");
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings({ id: crypto.randomUUID() }).complete.post();

    expect(error?.status).toBe(401);
  });
});
