import { Worker } from "bullmq";
import { RedisClient } from "bun";

import { env } from "../env";
import { logger } from "../logger";
import { PARSING_QUEUE, type ParsingJob } from "./queue";
import { abandonParsing, parseSource } from "./service";

async function giveUp(drawingId: string, sourceKey: string): Promise<void> {
  try {
    await abandonParsing(drawingId, sourceKey);
  } catch (error) {
    logger.error({ err: error, drawingId }, "Could not mark the drawing failed");
  }
}

/** Consumes the Parsing queue until `close()` is called. */
export function startParsingWorker(): Worker<ParsingJob> {
  const worker = new Worker<ParsingJob>(
    PARSING_QUEUE,
    (job) => parseSource(job.data.drawingId, job.data.sourceKey),
    { connection: new RedisClient(env.redisUrl), concurrency: env.parsingConcurrency },
  );

  worker.on("failed", (job, error) => {
    if (job === undefined) {
      return;
    }

    const { drawingId, sourceKey } = job.data;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);

    logger.error(
      { err: error, drawingId, attempt: job.attemptsMade, exhausted },
      "Parsing attempt failed",
    );

    if (exhausted) {
      void giveUp(drawingId, sourceKey);
    }
  });

  worker.on("error", (error) => {
    logger.error({ err: error }, "Parsing worker error");
  });

  return worker;
}
