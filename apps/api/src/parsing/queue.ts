import { Queue } from "bullmq";
import { RedisClient } from "bun";

import { env } from "../env";

export const PARSING_QUEUE = "parsing";

/** A Parsing of the Fichier source at `sourceKey`, pending on the Dessin. */
export type ParsingJob = { drawingId: string; sourceKey: string };

// An invalid DXF never throws out of the job: only infrastructure errors are retried.
const ATTEMPTS = 5;

const parsingQueue = new Queue<ParsingJob>(PARSING_QUEUE, {
  connection: new RedisClient(env.redisUrl),
  defaultJobOptions: {
    attempts: ATTEMPTS,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 1000,
  },
});

export async function enqueueParsing(drawingId: string, sourceKey: string): Promise<void> {
  await parsingQueue.add("parse", { drawingId, sourceKey });
}

export function closeParsingQueue(): Promise<void> {
  return parsingQueue.close();
}
