import { describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";

import { app } from "../src/app";
import { signedUpCookie } from "./session";

const api = treaty(app);

const DXF = "0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n";

function create(cookie: string, name: string) {
  return api.drawings.post(
    { name, filename: `${name}.dxf`, sizeBytes: DXF.length },
    { headers: { cookie } },
  );
}

async function createdDrawing(cookie: string, name: string) {
  const { data, error } = await create(cookie, name);

  if (data === null) {
    throw new Error(`expected a created drawing, got ${JSON.stringify(error?.value)}`);
  }

  return data;
}

describe("POST /drawings", () => {
  it("creates a drawing awaiting upload, with a presigned PUT URL", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { data, status } = await create(cookie, "Ground floor");

    expect(status).toBe(201);
    expect(data?.drawing).toMatchObject({
      name: "Ground floor",
      description: null,
      status: "awaiting_upload",
      error: null,
      sizeBytes: null,
      dxfVersion: null,
      layers: null,
    });
    expect(data?.drawing.createdAt).toBeInstanceOf(Date);
    // Time-ordered UUID v7: the version digit opens the third group.
    expect(data?.drawing.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-7[\da-f]{3}-/);
  });

  it("gives an upload URL that accepts a direct PUT to the storage", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { uploadUrl } = await createdDrawing(cookie, "Plan");

    const upload = await fetch(uploadUrl, { method: "PUT", body: DXF });

    expect(upload.status).toBe(200);
  });

  it("gives an upload URL that expires within 15 minutes", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { uploadUrl } = await createdDrawing(cookie, "Plan");

    const expiresIn = Number(new URL(uploadUrl).searchParams.get("X-Amz-Expires"));

    expect(expiresIn).toBeGreaterThan(0);
    expect(expiresIn).toBeLessThanOrEqual(15 * 60);
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings.post({ name: "Plan", filename: "plan.dxf", sizeBytes: 1 });

    expect(error?.status).toBe(401);
  });

  it("answers 400 in the error envelope for an invalid body", async () => {
    const cookie = await signedUpCookie(app.handle);

    const { error } = await api.drawings.post(
      { name: "", filename: "plan.dxf", sizeBytes: 0 },
      { headers: { cookie } },
    );

    expect(error?.status).toBe(400);
    expect(error?.value).toEqual({
      error: {
        code: "VALIDATION",
        message: "Invalid request",
        details: expect.arrayContaining([
          expect.objectContaining({ path: "/name" }),
          expect.objectContaining({ path: "/sizeBytes" }),
        ]),
      },
    });
  });

  it("answers 400 when the declared size exceeds the upload limit", async () => {
    const cookie = await signedUpCookie(app.handle);

    const { error } = await api.drawings.post(
      { name: "Huge", filename: "huge.dxf", sizeBytes: Number.MAX_SAFE_INTEGER },
      { headers: { cookie } },
    );

    expect(error?.status).toBe(400);
  });
});

describe("GET /drawings", () => {
  it("lists the owner's drawings, most recent first", async () => {
    const cookie = await signedUpCookie(app.handle);
    await createdDrawing(cookie, "First");
    await createdDrawing(cookie, "Second");
    await createdDrawing(cookie, "Third");

    const { data, status } = await api.drawings.get({ headers: { cookie } });

    expect(status).toBe(200);
    expect(data?.map((drawing) => drawing.name)).toEqual(["Third", "Second", "First"]);
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings.get();

    expect(error?.status).toBe(401);
  });
});

describe("GET /drawings/:id", () => {
  it("returns the drawing's summary", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { drawing } = await createdDrawing(cookie, "Plan");

    const { data, status } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(status).toBe(200);
    expect(data).toEqual(drawing);
  });

  it("answers 404 for an unknown drawing", async () => {
    const cookie = await signedUpCookie(app.handle);

    const { error } = await api.drawings({ id: crypto.randomUUID() }).get({ headers: { cookie } });

    expect(error?.status).toBe(404);
    expect(error?.value).toEqual({
      error: { code: "DRAWING_NOT_FOUND", message: "Drawing not found" },
    });
  });

  it("answers 400 for an id that is not a UUID", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { error } = await api.drawings({ id: "nope" }).get({ headers: { cookie } });

    expect(error?.status).toBe(400);
    expect(error?.value).toMatchObject({ error: { code: "VALIDATION" } });
  });
});

describe("PATCH /drawings/:id", () => {
  it("renames the drawing and sets its description", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { drawing } = await createdDrawing(cookie, "Plan");

    const { data, status } = await api
      .drawings({ id: drawing.id })
      .patch({ name: "Ground floor", description: "Rev. B" }, { headers: { cookie } });

    expect(status).toBe(200);
    expect(data).toMatchObject({ id: drawing.id, name: "Ground floor", description: "Rev. B" });

    const { data: fetched } = await api.drawings({ id: drawing.id }).get({ headers: { cookie } });

    expect(fetched).toMatchObject({ name: "Ground floor", description: "Rev. B" });
  });

  it("leaves the fields that are not sent untouched, and clears the description with null", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { drawing } = await createdDrawing(cookie, "Plan");
    await api.drawings({ id: drawing.id }).patch({ description: "Draft" }, { headers: { cookie } });

    const { data } = await api
      .drawings({ id: drawing.id })
      .patch({ description: null }, { headers: { cookie } });

    expect(data).toMatchObject({ name: "Plan", description: null });
  });

  it("answers 400 for an empty name or an empty body", async () => {
    const cookie = await signedUpCookie(app.handle);
    const { drawing } = await createdDrawing(cookie, "Plan");

    const emptyName = await api
      .drawings({ id: drawing.id })
      .patch({ name: "" }, { headers: { cookie } });

    const emptyBody = await api.drawings({ id: drawing.id }).patch({}, { headers: { cookie } });

    expect(emptyName.error?.status).toBe(400);
    expect(emptyBody.error?.status).toBe(400);
    expect(emptyBody.error?.value).toMatchObject({ error: { code: "VALIDATION" } });
  });

  it("answers 401 without a session", async () => {
    const { error } = await api.drawings({ id: crypto.randomUUID() }).patch({ name: "Plan" });

    expect(error?.status).toBe(401);
  });
});

describe("isolation", () => {
  it("hides a drawing from every other user", async () => {
    const owner = await signedUpCookie(app.handle);
    const intruder = await signedUpCookie(app.handle);
    const { drawing } = await createdDrawing(owner, "Private plan");

    const list = await api.drawings.get({ headers: { cookie: intruder } });
    const read = await api.drawings({ id: drawing.id }).get({ headers: { cookie: intruder } });

    const patch = await api
      .drawings({ id: drawing.id })
      .patch({ name: "Hacked" }, { headers: { cookie: intruder } });

    const { data: untouched } = await api
      .drawings({ id: drawing.id })
      .get({ headers: { cookie: owner } });

    expect(list.data).toEqual([]);
    expect(read.error?.status).toBe(404);
    expect(patch.error?.status).toBe(404);
    expect(patch.error?.value).toMatchObject({ error: { code: "DRAWING_NOT_FOUND" } });
    expect(untouched?.name).toBe("Private plan");
  });
});
