import { describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { Elysia, t } from "elysia";

import { app } from "../src/app";

// Throwaway routes mounted on top of the real app, to reach the error paths
// that the socle routes cannot trigger on their own.
const probeApp = new Elysia()
  .use(app)
  .post("/probe/echo", ({ body }) => body, {
    body: t.Object({ name: t.String({ minLength: 1 }), count: t.Integer() }),
  })
  .get("/probe/crash", () => {
    throw new Error("database password is hunter2");
  });

const api = treaty(probeApp);

describe("error envelope", () => {
  it("returns 400 with validation details for an invalid body", async () => {
    const { error } = await api.probe.echo.post({ name: "", count: 1.5 });

    expect(error?.status).toBe(400);
    expect(error?.value).toEqual({
      error: {
        code: "VALIDATION",
        message: "Invalid request",
        details: expect.arrayContaining([
          expect.objectContaining({ path: "/name" }),
          expect.objectContaining({ path: "/count" }),
        ]),
      },
    });
  });

  it("returns 404 for an unknown route", async () => {
    const response = await app.handle(new Request("http://localhost/does-not-exist"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "NOT_FOUND", message: "Route not found" },
    });
  });

  it("returns 500 without leaking the internal error message", async () => {
    const { error } = await api.probe.crash.get();

    expect(error?.status).toBe(500);
    expect(error?.value).toEqual({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
  });
});
