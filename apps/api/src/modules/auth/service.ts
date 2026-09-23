import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";

import { db } from "../../db/client";
import { env } from "../../env";
import * as schema from "./schema";

/** Mount point of the Better Auth handler (its default `basePath`). */
export const AUTH_BASE_PATH = "/api/auth";

export const auth = betterAuth({
  basePath: AUTH_BASE_PATH,
  baseURL: env.auth.url,
  secret: env.auth.secret,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  // Only used to generate the OpenAPI paths: our own Scalar UI documents them.
  plugins: [openAPI({ disableDefaultReference: true })],
  telemetry: { enabled: false },
});

export type AuthUser = typeof auth.$Infer.Session.user;

export type AuthSession = typeof auth.$Infer.Session.session;

export type AuthContext = { user: AuthUser; session: AuthSession };

/** The user and session behind the request's session cookie, or `null`. */
export async function getAuthContext(headers: Headers): Promise<AuthContext | null> {
  const result = await auth.api.getSession({ headers });

  return result === null ? null : { user: result.user, session: result.session };
}

type OpenApiSchema = Awaited<ReturnType<typeof auth.api.generateOpenAPISchema>>;

/**
 * Better Auth's routes as OpenAPI paths and components, prefixed with their mount
 * point and grouped under the `Auth` tag.
 */
export async function authOpenApi(): Promise<OpenApiSchema> {
  const { paths, components, ...rest } = await auth.api.generateOpenAPISchema();
  const prefixed: OpenApiSchema["paths"] = {};

  for (const [path, operations] of Object.entries(paths)) {
    for (const operation of Object.values(operations)) {
      operation.tags = ["Auth"];
    }

    prefixed[`${AUTH_BASE_PATH}${path}`] = operations;
  }

  return { ...rest, paths: prefixed, components };
}
