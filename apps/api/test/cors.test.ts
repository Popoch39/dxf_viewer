import { describe, expect, it } from "bun:test";

import { app } from "../src/app";
import { env } from "../src/env";
import { uniqueEmail } from "./session";

function preflight(origin: string): Promise<Response> {
  return app.handle(
    new Request("http://localhost/drawings", {
      method: "OPTIONS",
      headers: {
        origin,
        "access-control-request-method": "GET",
      },
    }),
  );
}

describe("cors", () => {
  it("allows the viewer origin, with credentials", async () => {
    const response = await preflight(env.viewerUrl);

    expect(response.headers.get("access-control-allow-origin")).toBe(env.viewerUrl);
    expect(response.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("does not allow another origin", async () => {
    const response = await preflight("http://evil.example");

    expect(response.headers.get("access-control-allow-origin")).not.toBe("http://evil.example");
  });

  it("lets Better Auth accept a sign-up coming from the viewer", async () => {
    const response = await app.handle(
      new Request("http://localhost/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json", origin: env.viewerUrl },
        body: JSON.stringify({
          email: uniqueEmail(),
          password: "correct horse battery staple",
          name: "Ada",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(env.viewerUrl);
  });
});
