import { describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";
import { Elysia } from "elysia";

import { authPlugin } from "../src/modules/auth";
import {
  authRequest,
  cookieHeader,
  PASSWORD,
  signedUpCookie,
  signIn,
  signUp,
  uniqueEmail,
} from "./session";

// Throwaway protected route next to the Better Auth handler. Not built on top of
// `app`: its OpenAPI routes cannot be registered twice in the same process.
const probeApp = new Elysia()
  .use(authPlugin)
  .get("/probe/me", ({ user, session }) => ({ userId: user.id, sessionUserId: session.userId }), {
    auth: true,
  });

const api = treaty(probeApp);

const { handle } = probeApp;

describe("auth", () => {
  it("signs up a new account", async () => {
    const email = uniqueEmail();
    const response = await signUp(handle, email);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { email } });
  });

  it("refuses to sign up with an email already in use", async () => {
    const email = uniqueEmail();
    await signUp(handle, email);
    const response = await signUp(handle, email);

    expect(response.status).toBe(422);
  });

  it("signs in with the right credentials and returns a session cookie", async () => {
    const email = uniqueEmail();
    await signUp(handle, email);
    const response = await signIn(handle, email, PASSWORD);

    expect(response.status).toBe(200);
    expect(cookieHeader(response)).toContain("better-auth.session_token=");
  });

  it("refuses wrong credentials", async () => {
    const email = uniqueEmail();
    await signUp(handle, email);
    const response = await signIn(handle, email, "wrong password!");

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
    const cookie = await signedUpCookie(handle);
    const { data, status } = await api.probe.me.get({ headers: { cookie } });

    expect(status).toBe(200);

    if (data === null || "error" in data) {
      throw new Error("expected the probe payload");
    }

    expect(data.userId).toBeString();
    expect(data.sessionUserId).toBe(data.userId);
  });

  it("answers 401 again after sign-out", async () => {
    const cookie = await signedUpCookie(handle);
    const signOut = await authRequest(handle, "/sign-out", "{}", cookie);
    const { error } = await api.probe.me.get({ headers: { cookie } });

    expect(signOut.status).toBe(200);
    expect(error?.status).toBe(401);
  });
});
