import { logger } from "./logger";

/**
 * Runs `close` once on SIGTERM or SIGINT, then exits. Required in the distroless
 * image: as PID 1, a process gets no default signal handlers, and `docker stop`
 * would wait for its timeout.
 */
export function closeOnSignal(close: () => Promise<void>): void {
  let shuttingDown = false;

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    try {
      await close();
      logger.flush();
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Shutdown failed");
      logger.flush();
      process.exit(1);
    }
  }

  process.on("SIGTERM", (signal) => void shutdown(signal));

  process.on("SIGINT", (signal) => void shutdown(signal));
}
