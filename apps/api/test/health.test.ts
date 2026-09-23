import { describe, expect, it } from "bun:test";

import { treaty } from "@elysiajs/eden";

import { app } from "../src/app";

const api = treaty(app);

describe("GET /health", () => {
  it("reports the API and every infra dependency as reachable", async () => {
    const { data, status } = await api.health.get();

    expect(status).toBe(200);
    expect(data).toEqual({
      status: "ok",
      checks: { api: "ok", postgres: "ok", redis: "ok", storage: "ok" },
    });
  });
});
