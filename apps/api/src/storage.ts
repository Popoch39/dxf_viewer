import { S3Client } from "bun";

import { env } from "./env";
import { logger } from "./logger";

export const storage = new S3Client(env.s3);

/** Lifetime of an upload URL: enough to start a PUT, too short for a leaked link to matter. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

/** Lifetime of a download URL: the viewer fetches it right away. */
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;

/** Presigned URL for a direct PUT of the object at `key`, bypassing the API. */
export function presignUpload(key: string): string {
  return storage.presign(key, { method: "PUT", expiresIn: UPLOAD_URL_TTL_SECONDS });
}

/** Presigned URL for a direct GET of the object at `key`. */
export function presignDownload(key: string): string {
  return storage.presign(key, { method: "GET", expiresIn: DOWNLOAD_URL_TTL_SECONDS });
}

/**
 * Deletes objects no row points to any more. Best effort: the change that
 * orphaned them is already committed, so a failure is only logged.
 */
export async function dropObjects(keys: string[]): Promise<void> {
  try {
    await Promise.all(keys.map((key) => storage.delete(key)));
  } catch (error) {
    logger.error({ err: error, keys }, "Could not delete orphaned objects");
  }
}

/** Size in bytes of the object at `key`, or null when there is none. */
export async function objectSize(key: string): Promise<number | null> {
  try {
    const { size } = await storage.file(key).stat();

    return size;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "NoSuchKey") {
      return null;
    }

    throw error;
  }
}
