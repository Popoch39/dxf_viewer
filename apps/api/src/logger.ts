import { type DestinationStream, type Level, type LevelWithSilent, type Logger, pino } from "pino";

import { env } from "./env";

export type { Level, Logger };

/**
 * Safety net only: routes never log bodies or headers, but an object logged by
 * mistake must not leak credentials.
 */
const REDACTED_PATHS = [
  "password",
  "*.password",
  "cookie",
  "*.cookie",
  "authorization",
  "*.authorization",
  "token",
  "*.token",
];

/**
 * JSON lines on stdout, without transports: they run in worker threads, which
 * `bun build --compile` binaries cannot load. `pino-pretty` is piped in dev.
 */
export function createLogger(level: LevelWithSilent, destination?: DestinationStream): Logger {
  return pino({ level, redact: REDACTED_PATHS }, destination);
}

export const logger = createLogger(env.logLevel);
