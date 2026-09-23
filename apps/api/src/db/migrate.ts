import { migrate } from "drizzle-orm/bun-sql/migrator";

import { db } from "./client";

// Resolved from the working directory (`apps/api` in dev and tests, `/app` in the
// Docker image): inside a compiled binary, `import.meta.dir` is a virtual path.
const migrationsFolder = "./drizzle";

export async function applyMigrations(): Promise<void> {
  await migrate(db, { migrationsFolder });
}

if (import.meta.main) {
  await applyMigrations();
  await db.$client.close();
}
