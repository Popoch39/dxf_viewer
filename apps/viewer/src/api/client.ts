import { treaty } from "@elysiajs/eden";
import { type TSchema, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import type { App, ErrorEnvelope } from "api";

import { env } from "@/env";

/** Typed client of the API. Only `src/api/<module>.ts` files call it. */
export const api = treaty<App>(env.apiUrl, {
  // The session is a cookie set by the API, on another origin than the viewer.
  fetch: { credentials: "include" },
});

type ErrorBody = ErrorEnvelope["error"];

/** A non-2xx answer of the API, thrown by `unwrap()`. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: ErrorBody["details"];

  constructor(status: number, body: ErrorBody) {
    super(body.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

// The API answers every error with this envelope, but a proxy or a crash in
// between may not: the body is checked before being trusted. Typed against the
// API's own `ErrorEnvelope`, so a drift between the two fails the type check.
const ErrorEnvelopeSchema: TSchema & { static: ErrorEnvelope } = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    details: Type.Optional(
      Type.Array(Type.Object({ path: Type.String(), message: Type.String() })),
    ),
  }),
});

interface EdenResult {
  data: unknown;
  error: { value: unknown } | null;
  status: number;
}

type SuccessData<Result extends EdenResult> = Extract<Result, { error: null }>["data"];

/**
 * Resolves an Eden call to its data, or throws an `ApiRequestError`, so that
 * TanStack Query sees failures: `queryFn: () => unwrap(api.drawings.get())`.
 */
export async function unwrap<Result extends EdenResult>(
  request: Promise<Result>,
): Promise<SuccessData<Result>> {
  const result = await request;

  if (result.error === null) {
    return result.data;
  }

  const { value } = result.error;

  throw new ApiRequestError(
    result.status,
    Value.Check(ErrorEnvelopeSchema, value)
      ? value.error
      : { code: "UNEXPECTED_RESPONSE", message: `HTTP ${result.status}` },
  );
}
