import { describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { Elysia } from "elysia";

import { env } from "../src/env";
import { authPlugin } from "../src/modules/auth";

// Throwaway protected route next to the Better Auth handler. Not built on top of
// `app`: its OpenAPI routes cannot be registered twice in the same process.
const probeApp = new Elysia()
  .use(authPlugin)
  .get("/probe/me", ({ user, session }) => ({ userId: user.id, sessionUserId: session.userId }), {
    auth: true,
  });

const api = treaty(probeApp);

const PASSWORD = "correct horse battery staple";

function uniqueEmail(): string {
  return `user-${crypto.randomUUID()}@example.com`;
}

// Better Auth routes are mounted as a raw handler, which Eden cannot type.
function authRequest(path: string, json: string, cookie?: string): Promise<Response> {
  const headers = new Headers({ "content-type": "application/json", origin: env.auth.url });

  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }

  return probeApp.handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: "POST",
      headers,
      body: json,
    }),
  );
}

function signUp(email: string): Promise<Response> {
  return authRequest("/sign-up/email", JSON.stringify({ email, password: PASSWORD, name: "Ada" }));
}

function signIn(email: string, password: string): Promise<Response> {
  return authRequest("/sign-in/email", JSON.stringify({ email, password }));
}

/** `name=value` pairs of the `Set-Cookie` headers, ready for a `Cookie` header. */
function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

async function signedUpCookie(): Promise<string> {
  const email = uniqueEmail();
  await signUp(email);
  const response = await signIn(email, PASSWORD);

  return cookieHeader(response);
}

describe("auth", () => {
  it("signs up a new account", async () => {
    const email = uniqueEmail();
    const response = await signUp(email);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email } });
  });

  it("refuses to sign up with an email already in use", async () => {
    const email = uniqueEmail();
    await signUp(email);
    const response = await signUp(email);

    expect(response.status).toBe(422);
  });

  it("signs in with the right credentials and returns a session cookie", async () => {
    const email = uniqueEmail();
    await signUp(email);
    const response = await signIn(email, PASSWORD);

    expect(response.status).toBe(200);
    expect(cookieHeader(response)).toContain("better-auth.session_token=");
  });

  it("refuses wrong credentials", async () => {
    const email = uniqueEmail();
    await signUp(email);
    const response = await signIn(email, "wrong password!");

    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it("answers 401 in the error envelope on a protected route without a cookie", async () => {
    const { error } = await api.probe.me.get();

    expect(error?.status).toBe(401);
    expect(error?.value).toEqual({
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  });

  it("provides user and session to a protected route with a valid cookie", async () => {
    const cookie = await signedUpCookie();
    const { data, status } = await api.probe.me.get({ headers: { cookie } });

    expect(status).toBe(200);

    if (data === null || "error" in data) {
      throw new Error("expected the probe payload");
    }

    expect(data.userId).toBeString();
    expect(data.sessionUserId).toBe(data.userId);
  });

  it("answers 401 again after sign-out", async () => {
    const cookie = await signedUpCookie();
    const signOut = await authRequest("/sign-out", "{}", cookie);
    const { error } = await api.probe.me.get({ headers: { cookie } });

    expect(signOut.status).toBe(200);
    expect(error?.status).toBe(401);
  });
});
