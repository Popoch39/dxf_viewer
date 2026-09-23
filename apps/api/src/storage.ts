import { S3Client } from "bun";

import { env } from "./env";

export const storage = new S3Client(env.s3);

/** Lifetime of an upload URL: enough to start a PUT, too short for a leaked link to matter. */
const UPLOAD_URL_TTL_SECONDS = 10 * 60;

/** Presigned URL for a direct PUT of the object at `key`, bypassing the API. */
export function presignUpload(key: string): string {
  return storage.presign(key, { method: "PUT", expiresIn: UPLOAD_URL_TTL_SECONDS });
}
