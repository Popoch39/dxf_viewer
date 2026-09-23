import { Elysia } from "elysia";

import { Health } from "./model";
import { checkHealth } from "./service";

export const health = new Elysia({ tags: ["Health"] }).get(
  "/health",
  async ({ status }) => {
    const report = await checkHealth();

    return report.status === "ok" ? report : status(503, report);
  },
  {
    response: { 200: Health, 503: Health },
    detail: { summary: "Reachability of the API, Postgres, Redis and object storage" },
  },
);
