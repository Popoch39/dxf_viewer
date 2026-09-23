import { type ElysiaOpenAPIConfig, openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { errorHandler } from "./errors";
import { authPlugin } from "./modules/auth";
import { authOpenApi } from "./modules/auth/service";
import { health } from "./modules/health";

const authDocs = await authOpenApi();

const documentation = {
  info: { title: "DXF Viewer API", version: "0.0.0" },
  tags: [
    { name: "Auth", description: "Email + password accounts and cookie sessions" },
    { name: "Health" },
  ],
  paths: authDocs.paths,
  components: authDocs.components,
};

export const app = new Elysia()
  .use(errorHandler)
  .use(
    openapi({
      // SAFETY: Better Auth generates valid OpenAPI; only its declared types
      // (plain strings instead of literal unions) differ from `openapi-types`.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- mismatch between two third-party type definitions of the same format
      documentation: documentation as ElysiaOpenAPIConfig["documentation"],
    }),
  )
  .use(authPlugin)
  .use(health);

export type App = typeof app;
