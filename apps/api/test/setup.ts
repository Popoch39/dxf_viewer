// Preloaded by `bun test` (see bunfig.toml): tests run against the real infra from
// `compose.yaml`, with the schema brought up to date first.

// Silent unless asked (`LOG_LEVEL=debug bun test`). Set before `env.ts` is
// evaluated, hence the dynamic import below: static imports are hoisted.
Bun.env.LOG_LEVEL ??= "silent";

// Small enough for a test to upload a file over the limit; above every fixture.
Bun.env.MAX_UPLOAD_BYTES = String(64 * 1024);

const { applyMigrations } = await import("../src/db/migrate");

await applyMigrations();
