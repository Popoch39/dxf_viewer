import { Elysia, StatusMap } from "elysia";

import type { Level, Logger } from "./logger";

const REQUEST_ID_HEADER = "x-request-id";

/** Client-supplied ids are kept only when they cannot corrupt a log line. */
const VALID_REQUEST_ID = /^[\w.-]{1,128}$/u;

interface RequestTrace {
  requestId: string;
  start: number;
  error?: unknown;
}

function requestIdFrom(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER);

  return incoming !== null && VALID_REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
}

function levelFor(status: number): Level {
  if (status >= 500) {
    return "error";
  }

  return status >= 400 ? "warn" : "info";
}

const NAMED_STATUSES = new Map<number | string, number>(Object.entries(StatusMap));

/** `set.status` holds either a code or a status name such as `"Not Found"`. */
function statusCode(status: number | keyof typeof StatusMap = 200): number {
  return NAMED_STATUSES.get(status) ?? Number(status);
}

/**
 * One log line per request, at a level matching its status; 5xx lines carry the
 * error. Must be registered before `errorHandler` so its `onError` sees errors
 * before the envelope is sent.
 */
export function requestLogger(log: Logger) {
  // Keyed by request rather than `derive`d: `derive` does not run on unknown
  // routes or parse errors, which must be logged too.
  const traces = new WeakMap<Request, RequestTrace>();

  return new Elysia({ name: "request-logger" })
    .onRequest(({ request, set }) => {
      const requestId = requestIdFrom(request);

      traces.set(request, { requestId, start: performance.now() });
      set.headers[REQUEST_ID_HEADER] = requestId;
    })
    .onError({ as: "global" }, ({ request, error }) => {
      const trace = traces.get(request);

      if (trace !== undefined) {
        trace.error = error;
      }
    })
    .onAfterResponse({ as: "global" }, ({ request, set, responseValue }) => {
      const trace = traces.get(request);

      if (trace === undefined) {
        return;
      }

      // A `Response` returned by a handler (Better Auth) carries its own status.
      const status =
        responseValue instanceof Response ? responseValue.status : statusCode(set.status);

      const { pathname } = new URL(request.url);
      const level = levelFor(status);

      log[level](
        {
          requestId: trace.requestId,
          method: request.method,
          path: pathname,
          status,
          durationMs: Math.round((performance.now() - trace.start) * 100) / 100,
          ...(level === "error" && trace.error !== undefined && { err: trace.error }),
        },
        `${request.method} ${pathname} ${status}`,
      );
    });
}
