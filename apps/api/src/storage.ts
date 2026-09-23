import { S3Client } from "bun";

import { env } from "./env";

export const storage = new S3Client(env.s3);
