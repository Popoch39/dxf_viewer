import { TypeCompiler } from "@sinclair/typebox/compiler";
import { RedisClient } from "bun";
import { t } from "elysia";

import { env } from "../env";
import { logger } from "../logger";
import { DrawingStatus } from "../modules/drawings/model";
import { drawing, type DrawingRow } from "../modules/drawings/schema";
import { redis } from "../redis";

/** A change of Statut, as published on the channel of its Dessin. */
const StatusChange = t.Object({
  status: DrawingStatus,
  error: t.Nullable(t.String()),
  // `updatedAt` of the row, in ms, from the database clock: orders changes
  // published by different processes.
  at: t.Number(),
});

export type StatusChange = typeof StatusChange.static;

const statusChange = TypeCompiler.Compile(StatusChange);

/** The columns a change of Statut is published from, for `.returning()`. */
export const statusColumns = {
  status: drawing.status,
  error: drawing.error,
  updatedAt: drawing.updatedAt,
};

export type StatusRow = Pick<DrawingRow, "status" | "error" | "updatedAt">;

export function statusChannel(drawingId: string): string {
  return `drawing-status:${drawingId}`;
}

/**
 * Publishes the Statut of a Dessin, just written. Best effort: the change is
 * already committed, and a stream that misses it reads it again on reconnect.
 */
export async function publishStatus(drawingId: string, row: StatusRow): Promise<void> {
  const change: StatusChange = {
    status: row.status,
    error: row.error,
    at: row.updatedAt.getTime(),
  };

  try {
    await redis.publish(statusChannel(drawingId), JSON.stringify(change));
  } catch (error) {
    logger.error({ err: error, drawingId }, "Could not publish the Statut");
  }
}

// A subscribed connection cannot send other commands: one connection is shared
// by every stream of the process, and opened by the first one.
let subscriber: RedisClient | null = null;

function sharedSubscriber(): RedisClient {
  subscriber ??= new RedisClient(env.redisUrl);

  return subscriber;
}

export function closeStatusSubscriber(): void {
  subscriber?.close();
  subscriber = null;
}

function parsedChange(message: string): StatusChange | null {
  try {
    const value: unknown = JSON.parse(message);

    if (statusChange.Check(value)) {
      return value;
    }
  } catch {
    // Reported below, like a well-formed message of the wrong shape.
  }

  logger.warn({ message }, "Ignored a malformed Statut message");

  return null;
}

function nothingToWake(): void {}

/** The changes of Statut of a Dessin, received since the subscription. */
export type StatusSubscription = AsyncIterable<StatusChange> & AsyncDisposable;

/**
 * Subscribes to the changes of Statut of a Dessin. The subscription is dropped
 * when disposed, or as soon as `signal` aborts, even while its iteration waits
 * for a change.
 */
export async function subscribeToStatus(
  drawingId: string,
  signal: AbortSignal,
): Promise<StatusSubscription> {
  const channel = statusChannel(drawingId);
  const received: StatusChange[] = [];
  let closed = false;
  let wake = nothingToWake;

  function listener(message: string): void {
    const change = parsedChange(message);

    if (change !== null) {
      received.push(change);
      wake();
    }
  }

  async function close(): Promise<void> {
    if (closed) {
      return;
    }

    closed = true;
    signal.removeEventListener("abort", onAbort);
    wake();
    await sharedSubscriber().unsubscribe(channel, listener);
  }

  async function closeOnAbort(): Promise<void> {
    try {
      await close();
    } catch (error) {
      logger.error({ err: error, drawingId }, "Could not unsubscribe from the Statut");
    }
  }

  function onAbort(): void {
    void closeOnAbort();
  }

  async function* changes(): AsyncGenerator<StatusChange> {
    for (;;) {
      if (closed) {
        return;
      }

      const change = received.shift();

      if (change === undefined) {
        const { promise, resolve } = Promise.withResolvers<void>();
        wake = resolve;
        // oxlint-disable-next-line eslint/no-await-in-loop -- changes arrive one after the other: the loop waits for the next one
        await promise;
      } else {
        yield change;
      }
    }
  }

  await sharedSubscriber().subscribe(channel, listener);
  signal.addEventListener("abort", onAbort);

  if (signal.aborted) {
    await close();
  }

  return { [Symbol.asyncIterator]: changes, [Symbol.asyncDispose]: close };
}
