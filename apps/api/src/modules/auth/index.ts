import { Elysia } from "elysia";

import { ApiError, errorHandler } from "../../errors";
import { AUTH_BASE_PATH, auth, getAuthContext } from "./service";

/**
 * Serves the Better Auth handler under `/api/auth` and adds the `auth` macro:
 * `{ auth: true }` on a route injects `user` and `session`, or answers 401.
 */
export const authPlugin = new Elysia({ name: "auth" })
  .use(errorHandler)
  // Not `.mount(auth.handler)`: without a prefix it catches every path, and our
  // 404 envelope would turn into Better Auth's empty 404.
  .all(`${AUTH_BASE_PATH}/*`, ({ request }) => auth.handler(request), {
    // Documented from Better Auth's own OpenAPI schema instead.
    detail: { hide: true },
  })
  .macro({
    auth: {
      async resolve({ request }) {
        const context = await getAuthContext(request.headers);

        if (context === null) {
          throw new ApiError(401, "UNAUTHORIZED", "Authentication required");
        }

        return context;
      },
    },
  });
