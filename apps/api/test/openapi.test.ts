import { describe, expect, it } from "bun:test";

import { app } from "../src/app";

describe("OpenAPI documentation", () => {
  it("serves the Scalar UI at /openapi", async () => {
    const response = await app.handle(new Request("http://localhost/openapi"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("scalar");
  });

  it("documents the health route in the generated spec", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      info: { title: "DXF Viewer API" },
      paths: { "/health": { get: expect.any(Object) } },
    });
  });

  it("documents the Better Auth routes in the generated spec", async () => {
    const response = await app.handle(new Request("http://localhost/openapi/json"));

    expect(await response.json()).toMatchObject({
      paths: {
        "/api/auth/sign-up/email": { post: { tags: ["Auth"] } },
        "/api/auth/sign-in/email": { post: { tags: ["Auth"] } },
        "/api/auth/sign-out": { post: { tags: ["Auth"] } },
      },
    });
  });
});
