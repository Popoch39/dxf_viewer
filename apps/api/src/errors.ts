import { Elysia, t } from "elysia";

export const ErrorDetail = t.Object({ path: t.String(), message: t.String() });

export type ErrorDetail = typeof ErrorDetail.static;

/** Every error response of the API has this shape. */
export const ErrorEnvelope = t.Object({
  error: t.Object({
    code: t.String(),
    message: t.String(),
    details: t.Optional(t.Array(ErrorDetail)),
  }),
});

export type ErrorEnvelope = typeof ErrorEnvelope.static;

/** Business error with a stable `code`, thrown from routes and services. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function envelope(code: string, message: string, details?: ErrorDetail[]): ErrorEnvelope {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export const errorHandler = new Elysia({ name: "error-handler" })
  .error({ ApiError })
  .onError({ as: "global" }, ({ code, error, status }) => {
    switch (code) {
      case "ApiError": {
        return status(error.status, envelope(error.code, error.message));
      }

      case "VALIDATION": {
        const details = error.all.map((issue) => ({
          path: issue.path,
          message: issue.summary ?? issue.message,
        }));

        return status(400, envelope("VALIDATION", "Invalid request", details));
      }

      case "PARSE": {
        return status(400, envelope("PARSE", "Malformed request body"));
      }

      case "INVALID_FILE_TYPE": {
        return status(400, envelope("INVALID_FILE_TYPE", "Invalid file type"));
      }

      case "INVALID_COOKIE_SIGNATURE": {
        return status(400, envelope("INVALID_COOKIE_SIGNATURE", "Invalid cookie signature"));
      }

      case "NOT_FOUND": {
        return status(404, envelope("NOT_FOUND", "Route not found"));
      }

      default: {
        console.error(error);

        return status(500, envelope("INTERNAL", "Internal server error"));
      }
    }
  });
