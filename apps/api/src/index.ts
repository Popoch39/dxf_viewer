import { app } from "./app";
import { db } from "./db/client";
import { env } from "./env";
import { logger } from "./logger";
import { redis } from "./redis";

app.listen(env.port);

logger.info({ port: env.port }, `API listening on http://localhost:${env.port} (docs: /openapi)`);

let shuttingDown = false;

// Required in the distroless image: as PID 1, the server gets no default
// signal handlers, and `docker stop` would wait for its timeout.
async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, "Shutting down");

  try {
    await app.stop();
    redis.close();
    await db.$client.close();
    logger.flush();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Shutdown failed");
    logger.flush();
    process.exit(1);
  }
}

process.on("SIGTERM", (signal) => void shutdown(signal));

process.on("SIGINT", (signal) => void shutdown(signal));
