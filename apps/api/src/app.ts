import { openapi } from "@elysiajs/openapi";
import { Elysia } from "elysia";

import { errorHandler } from "./errors";
import { health } from "./modules/health";

export const app = new Elysia()
  .use(errorHandler)
  .use(
    openapi({
      documentation: {
        info: { title: "DXF Viewer API", version: "0.0.0" },
      },
    }),
  )
  .use(health);

export type App = typeof app;
