import { db } from "./db/client";
import { logger } from "./logger";
import { startParsingWorker } from "./parsing/worker";
import { redis } from "./redis";
import { closeOnSignal } from "./shutdown";

const worker = startParsingWorker();

logger.info("Parsing worker started");

closeOnSignal(async () => {
  // Waits for the running jobs to finish.
  await worker.close();
  // The connection the changes of Statut are published on.
  redis.close();
  await db.$client.close();
});
