// Preloaded by `bun test` (see bunfig.toml): tests run against the real infra from
// `compose.yaml`, with the schema brought up to date first.
import { applyMigrations } from "../src/db/migrate";

await applyMigrations();
