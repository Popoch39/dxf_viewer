import { migrate } from "drizzle-orm/bun-sql/migrator";

import { db } from "./client";

export const migrationsFolder = `${import.meta.dir}/../../drizzle`;

export async function applyMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  await applyMigrations();
  await db.$client.close();
}
