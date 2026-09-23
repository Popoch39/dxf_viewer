import { app } from "./app";
import { db } from "./db/client";
import { env } from "./env";
import { logger } from "./logger";
import { closeStatusSubscriber } from "./parsing/events";
import { closeParsingQueue } from "./parsing/queue";
import { redis } from "./redis";
import { closeOnSignal } from "./shutdown";

app.listen(env.port);

logger.info({ port: env.port }, `API listening on http://localhost:${env.port} (docs: /openapi)`);

closeOnSignal(async () => {
  await app.stop();
  await closeParsingQueue();
  closeStatusSubscriber();
  redis.close();
  await db.$client.close();
});
