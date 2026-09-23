import { env } from "../src/env";

/** `app.handle` of the Elysia instance that serves the Better Auth routes. */
export type Handle = (request: Request) => Promise<Response>;

export const PASSWORD = "correct horse battery staple";

export function uniqueEmail(): string {
  return `user-${crypto.randomUUID()}@example.com`;
}

// Better Auth routes are mounted as a raw handler, which Eden cannot type.
export function authRequest(handle: Handle, path: string, json: string, cookie?: string) {
  const headers = new Headers({ "content-type": "application/json", origin: env.auth.url });

  if (cookie !== undefined) {
    headers.set("cookie", cookie);
  }

  return handle(
    new Request(`http://localhost/api/auth${path}`, {
      method: "POST",
      headers,
      body: json,
    }),
  );
}

export function signUp(handle: Handle, email: string): Promise<Response> {
  return authRequest(
    handle,
    "/sign-up/email",
    JSON.stringify({ email, password: PASSWORD, name: "Ada" }),
  );
}

export function signIn(handle: Handle, email: string, password: string): Promise<Response> {
  return authRequest(handle, "/sign-in/email", JSON.stringify({ email, password }));
}

/** `name=value` pairs of the `Set-Cookie` headers, ready for a `Cookie` header. */
export function cookieHeader(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** Session cookie of a brand-new account. */
export async function signedUpCookie(handle: Handle): Promise<string> {
  const email = uniqueEmail();
  await signUp(handle, email);
  const response = await signIn(handle, email, PASSWORD);

  return cookieHeader(response);
}
