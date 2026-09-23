import { drizzle } from "drizzle-orm/bun-sql";

import { env } from "../env";

export const db = drizzle({ connection: env.databaseUrl });
