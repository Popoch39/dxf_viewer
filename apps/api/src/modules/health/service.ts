import { sql } from "drizzle-orm";

import { db } from "../../db/client";
import { redis } from "../../redis";
import { storage } from "../../storage";
import type { CheckStatus, Health } from "./model";

const PROBE_TIMEOUT_MS = 2000;

async function probe(check: () => Promise<void>): Promise<CheckStatus> {
  let timer: Timer | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new Error("probe timed out"));
    }, PROBE_TIMEOUT_MS);
  });

  try {
    await Promise.race([check(), timeout]);

    return "ok";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

export async function checkHealth(): Promise<Health> {
  const [postgres, redisStatus, storageStatus] = await Promise.all([
    probe(async () => {
      await db.execute(sql`select 1`);
    }),
    probe(async () => {
      await redis.ping();
    }),
    // Listing fails when the bucket is missing, unlike a HEAD on an absent key.
    probe(async () => {
      await storage.list({ maxKeys: 1 });
    }),
  ]);

  const checks = { api: "ok", postgres, redis: redisStatus, storage: storageStatus } as const;
  const allOk = postgres === "ok" && redisStatus === "ok" && storageStatus === "ok";

  return { status: allOk ? "ok" : "degraded", checks };
}
