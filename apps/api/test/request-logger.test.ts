import { describe, expect, it } from "bun:test";

import { Elysia } from "elysia";

import { ApiError, errorHandler } from "../src/errors";
import { createLogger } from "../src/logger";
import { requestLogger } from "../src/request-logger";

interface LogLine {
  level: number;
  msg: string;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  password?: string;
  err?: { message: string; stack: string };
}

const lines: LogLine[] = [];

const waiters: (() => void)[] = [];

const log = createLogger("info", {
  write(line: string) {
    // pino writes one JSON object per line, shaped by the fields logged here.
    const entry: LogLine = JSON.parse(line);

    lines.push(entry);
    waiters.shift()?.();
  },
});

// Standalone app rather than `.use(app)`: it only needs the logger and the
// error handler, and the real app can be `.use`d once per process.
const probeApp = new Elysia()
  .use(requestLogger(log))
  .use(errorHandler)
  .get("/probe/ok", () => ({ ok: true }))
  .get("/probe/conflict", () => {
    throw new ApiError(409, "CONFLICT", "Already exists");
  })
  .get("/probe/crash", () => {
    throw new Error("boom");
  });

/** Request lines are written after the response is sent. */
async function request(path: string, requestId?: string): Promise<[Response, LogLine]> {
  const headers = new Headers();

  if (requestId !== undefined) {
    headers.set("x-request-id", requestId);
  }

  lines.length = 0;

  const logged = new Promise<void>((resolve) => {
    waiters.push(resolve);
  });

  const response = await probeApp.handle(new Request(`http://localhost${path}`, { headers }));

  await logged;

  const [line] = lines;

  if (line === undefined) {
    throw new Error("No log line written");
  }

  return [response, line];
}

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;

describe("request logger", () => {
  it("logs a successful request at info, with its request id", async () => {
    const [response, line] = await request("/probe/ok?secret=1");
    const requestId = response.headers.get("x-request-id");

    expect(requestId).toMatch(UUID);
    expect(line).toMatchObject({
      level: 30,
      msg: "GET /probe/ok 200",
      requestId,
      method: "GET",
      path: "/probe/ok",
      status: 200,
    });
    expect(line.durationMs).toBeNumber();
  });

  it("keeps a valid incoming x-request-id", async () => {
    const [response, line] = await request("/probe/ok", "req_42.a-b");

    expect(response.headers.get("x-request-id")).toBe("req_42.a-b");
    expect(line.requestId).toBe("req_42.a-b");
  });

  it.each(["x".repeat(129), "a b", "<script>", 'quote"d'])(
    "replaces an invalid incoming x-request-id (%#)",
    async (incoming) => {
      const [response] = await request("/probe/ok", incoming);

      expect(response.headers.get("x-request-id")).toMatch(UUID);
    },
  );

  it("logs client errors at warn", async () => {
    const [response, line] = await request("/probe/conflict");

    expect(response.status).toBe(409);
    expect(line).toMatchObject({ level: 40, status: 409 });
    expect(line.err).toBeUndefined();
  });

  it("logs unknown routes at warn", async () => {
    const [response, line] = await request("/probe/nope");

    expect(response.status).toBe(404);
    expect(response.headers.get("x-request-id")).toMatch(UUID);
    expect(line).toMatchObject({ level: 40, status: 404, path: "/probe/nope" });
  });

  it("logs a crash once, at error, with its stack", async () => {
    const [response, line] = await request("/probe/crash");

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe(line.requestId ?? "");
    expect(await response.json()).toEqual({
      error: { code: "INTERNAL", message: "Internal server error" },
    });
    expect(line).toMatchObject({ level: 50, status: 500, err: { message: "boom" } });
    expect(line.err?.stack).toContain("boom");

    await Bun.sleep(10);
    expect(lines).toHaveLength(1);
  });
});

describe("logger", () => {
  it("redacts credentials logged by mistake", () => {
    lines.length = 0;
    log.info({ password: "hunter2" }, "oops");

    expect(lines[0]?.password).toBe("[Redacted]");
  });
});
