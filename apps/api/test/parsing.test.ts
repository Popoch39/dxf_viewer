import { afterAll, beforeAll, describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { parseDxf } from "@repo/dxf";
import type { Job } from "bullmq";

import { app } from "../src/app";
import { env } from "../src/env";
import type { DrawingSummary } from "../src/modules/drawings/model";
import type { ParsingJob } from "../src/parsing/queue";
import { startParsingWorker } from "../src/parsing/worker";
import { signedUpCookie } from "./session";

const api = treaty(app);

const worker = startParsingWorker();

// A real drawing, with layers and blocks, shared with the tests of the DXF module.
const FIXTURE = new URL(
  "../../../packages/dxf/test/fixtures/r2000-with-blocks.dxf",
  import.meta.url,
);

// Another drawing, without blocks, to replace the first one.
const REPLACEMENT_FIXTURE = new URL(
  "../../../packages/dxf/test/fixtures/r12-without-blocks.dxf",
  import.meta.url,
);

let source = "";

let replacement = "";

beforeAll(async () => {
  source = await Bun.file(FIXTURE).text();
  replacement = await Bun.file(REPLACEMENT_FIXTURE).text();
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

/** A Dessin whose Fichier source `body` was parsed successfully. */
async function readyDrawing(cookie: string, body: string) {
  const drawing = await uploadedDrawing(cookie, body);
  await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });
  const ready = await settledDrawing(cookie, drawing.id);

  expect(ready.status).toBe("ready");

  return ready;
}

/** Resolves once the worker has ended an attempt at the Parsing of the Dessin `id`. */
function parsingAttempt(id: string) {
  return new Promise<void>((resolve) => {
    const settle = (job: Job<ParsingJob> | undefined) => {
      if (job?.data.drawingId === id) {
        worker.off("completed", settle);
        worker.off("failed", settle);
        resolve();
      }
    };

    worker.on("completed", settle);
    worker.on("failed", settle);
  });
}

/** Starts the Remplacement of a Dessin and uploads `body` through its presigned URL. */
async function uploadedReplacement(cookie: string, id: string, body: string) {
  const { data, error } = await api
    .drawings({ id })
    .replace.post({ filename: "new.dxf", sizeBytes: body.length }, { headers: { cookie } });

  if (data === null) {
    throw new Error(`expected a pending upload, got ${JSON.stringify(error?.value)}`);
  }

  const upload = await fetch(data.uploadUrl, { method: "PUT", body });

  expect(upload.status).toBe(200);

  return data.drawing;
}

function links(drawing: { parsedUrl: string | null; sourceUrl: string | null }) {
  if (drawing.parsedUrl === null || drawing.sourceUrl === null) {
    throw new Error("expected links to the current revision");
  }

  return { parsedUrl: drawing.parsedUrl, sourceUrl: drawing.sourceUrl };
}

// The fields of the Résumé that describe the current revision.
function revision(drawing: DrawingSummary) {
  return {
    sizeBytes: drawing.sizeBytes,
    dxfVersion: drawing.dxfVersion,
    units: drawing.units,
    extent: drawing.extent,
    layers: drawing.layers,
    entityCounts: drawing.entityCounts,
    parsedAt: drawing.parsedAt,
  };
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

describe("POST /drawings/:id/replace", () => {
  it("keeps serving the current revision until the replacement is parsed", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);

    const pending = await uploadedReplacement(cookie, current.id, replacement);
    const { data: waiting } = await api.drawings({ id: current.id }).get({ headers: { cookie } });

    const { data: queued } = await api
      .drawings({ id: current.id })
      .complete.post(undefined, { headers: { cookie } });

    if (waiting === null || queued === null) {
      throw new Error("expected the drawing");
    }

    expect(pending.status).toBe("awaiting_upload");
    expect(waiting.status).toBe("awaiting_upload");
    expect(queued.status).toBe("queued");
    expect(revision(pending)).toEqual(revision(current));
    expect(revision(waiting)).toEqual(revision(current));
    expect(revision(queued)).toEqual(revision(current));

    const parsed = await fetch(links(waiting).parsedUrl);

    expect(await parsed.json()).toEqual(parseDxf(source));
  });

  it("switches to the new revision once parsed, and drops the old files", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);
    const old = links(current);

    await uploadedReplacement(cookie, current.id, replacement);
    await api.drawings({ id: current.id }).complete.post(undefined, { headers: { cookie } });

    const replaced = await settledDrawing(cookie, current.id);
    const expected = parseDxf(replacement);

    expect(replaced).toMatchObject({
      status: "ready",
      error: null,
      sizeBytes: replacement.length,
      dxfVersion: expected.meta.dxfVersion,
      extent: expected.meta.extent,
      layers: expected.layers,
      entityCounts: expected.meta.entityCounts,
    });

    const fresh = links(replaced);

    expect(await (await fetch(fresh.parsedUrl)).json()).toEqual(expected);
    expect(await (await fetch(fresh.sourceUrl)).text()).toBe(replacement);
    expect((await fetch(old.parsedUrl)).status).toBe(404);
    expect((await fetch(old.sourceUrl)).status).toBe(404);
  });

  it("keeps the Dessin parsé when the replacement has the same content", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);

    await uploadedReplacement(cookie, current.id, source);
    await api.drawings({ id: current.id }).complete.post(undefined, { headers: { cookie } });

    const replaced = await settledDrawing(cookie, current.id);
    const parsed = await fetch(links(replaced).parsedUrl);

    expect(replaced.status).toBe("ready");
    expect(await parsed.json()).toEqual(parseDxf(source));
  });

  it("keeps the current revision served, with the error, when the replacement is invalid", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);

    await uploadedReplacement(cookie, current.id, "this is not a drawing");
    await api.drawings({ id: current.id }).complete.post(undefined, { headers: { cookie } });

    const failed = await settledDrawing(cookie, current.id);

    expect(failed.status).toBe("failed");
    expect(failed.error).toStartWith("The file is not a valid DXF");
    expect(revision(failed)).toEqual(revision(current));

    const { parsedUrl, sourceUrl } = links(failed);

    expect(await (await fetch(parsedUrl)).json()).toEqual(parseDxf(source));
    expect(await (await fetch(sourceUrl)).text()).toBe(source);
  });

  it("takes the place of an upload still pending", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);

    await uploadedReplacement(cookie, drawing.id, replacement);
    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });

    const ready = await settledDrawing(cookie, drawing.id);

    expect(ready).toMatchObject({ status: "ready", sizeBytes: replacement.length });
  });

  it("answers 400 when the declared size exceeds the upload limit", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);

    const { error } = await api
      .drawings({ id: current.id })
      .replace.post(
        { filename: "huge.dxf", sizeBytes: env.maxUploadBytes + 1 },
        { headers: { cookie } },
      );

    expect(error?.status).toBe(400);
  });

  it("answers 404 to another user, and leaves the drawing untouched", async () => {
    const owner = await signedUpCookie(app.handle);
    const intruder = await signedUpCookie(app.handle);
    const current = await readyDrawing(owner, source);

    const { error } = await api
      .drawings({ id: current.id })
      .replace.post({ filename: "new.dxf", sizeBytes: 1 }, { headers: { cookie: intruder } });

    const { data } = await api.drawings({ id: current.id }).get({ headers: { cookie: owner } });

    expect(error?.status).toBe(404);
    expect(error?.value).toMatchObject({ error: { code: "DRAWING_NOT_FOUND" } });
    expect(data?.status).toBe("ready");
  });

  it("answers 401 without a session", async () => {
    const { error } = await api
      .drawings({ id: crypto.randomUUID() })
      .replace.post({ filename: "new.dxf", sizeBytes: 1 });

    expect(error?.status).toBe(401);
  });
});

describe("DELETE /drawings/:id", () => {
  it("deletes the drawing and both files of its current revision", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);
    const { parsedUrl, sourceUrl } = links(current);

    const { status } = await api.drawings({ id: current.id }).delete(undefined, {
      headers: { cookie },
    });

    const { data: list } = await api.drawings.get({ headers: { cookie } });
    const { error } = await api.drawings({ id: current.id }).get({ headers: { cookie } });

    expect(status).toBe(204);
    expect(list).toEqual([]);
    expect(error?.status).toBe(404);
    expect((await fetch(parsedUrl)).status).toBe(404);
    expect((await fetch(sourceUrl)).status).toBe(404);
  });

  it("deletes a drawing during a Remplacement, with its pending upload", async () => {
    const cookie = await signedUpCookie(app.handle);
    const current = await readyDrawing(cookie, source);
    const { parsedUrl, sourceUrl } = links(current);
    await uploadedReplacement(cookie, current.id, replacement);

    const { status } = await api.drawings({ id: current.id }).delete(undefined, {
      headers: { cookie },
    });

    const { error } = await api.drawings({ id: current.id }).get({ headers: { cookie } });

    expect(status).toBe(204);
    expect(error?.status).toBe(404);
    expect((await fetch(parsedUrl)).status).toBe(404);
    expect((await fetch(sourceUrl)).status).toBe(404);
  });

  it("deletes a drawing still awaiting its upload", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, "");

    const { status } = await api.drawings({ id: drawing.id }).delete(undefined, {
      headers: { cookie },
    });

    const { error } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(status).toBe(204);
    expect(error?.status).toBe(404);
  });

  it("stays deleted when deleted while its Parsing is queued", async () => {
    const cookie = await signedUpCookie(app.handle);
    const drawing = await uploadedDrawing(cookie, source);
    const attempted = parsingAttempt(drawing.id);

    await api.drawings({ id: drawing.id }).complete.post(undefined, { headers: { cookie } });

    const { status } = await api.drawings({ id: drawing.id }).delete(undefined, {
      headers: { cookie },
    });

    await attempted;

    const { data: list } = await api.drawings.get({ headers: { cookie } });
    const { error } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(status).toBe(204);
    expect(list).toEqual([]);
    expect(error?.status).toBe(404);
  });

  it("answers 404 to another user, and deletes nothing", async () => {
    const owner = await signedUpCookie(app.handle);
    const intruder = await signedUpCookie(app.handle);
    const current = await readyDrawing(owner, source);

    const { error } = await api
      .drawings({ id: current.id })
      .delete(undefined, { headers: { cookie: intruder } });

    const { data } = await api.drawings({ id: current.id }).get({ headers: { cookie: owner } });

    if (data === null) {
      throw new Error("expected the drawing");
    }

    const { parsedUrl, sourceUrl } = links(data);

    expect(error?.status).toBe(404);
    expect(error?.value).toMatchObject({ error: { code: "DRAWING_NOT_FOUND" } });
    expect(data.status).toBe("ready");
    expect(await (await fetch(parsedUrl)).json()).toEqual(parseDxf(source));
    expect(await (await fetch(sourceUrl)).text()).toBe(source);
  });

  it("answers 404 to an unknown drawing", async () => {
    const cookie = await signedUpCookie(app.handle);

    const { error } = await api
      .drawings({ id: crypto.randomUUID() })
      .delete(undefined, { headers: { cookie } });

    expect(error?.status).toBe(404);
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings({ id: crypto.randomUUID() }).delete();

    expect(error?.status).toBe(401);
  });
});
