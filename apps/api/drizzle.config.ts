import { defineConfig } from "drizzle-kit";

// Each module owns its tables in a `schema.ts` file. Migrations are applied by
// `bun run db:migrate` (Bun SQL driver), so drizzle-kit only generates them.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/**/schema.ts",
  out: "./drizzle",
});
