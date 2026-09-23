import { InvalidDxfError, type ParsedDrawing, parseDxf } from "@repo/dxf";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db/client";
import { logger } from "../logger";
import { drawing } from "../modules/drawings/schema";
import { storage } from "../storage";

// Every write is conditioned on the pending key: a job whose Fichier source is
// no longer pending (drawing deleted, upload replaced) changes nothing.
function pending(drawingId: string, sourceKey: string) {
  return and(eq(drawing.id, drawingId), eq(drawing.pendingSourceKey, sourceKey));
}

// Same content, same key: a retried job overwrites its own object.
function parsedKey(drawingId: string, sha256: string): string {
  return `parsed/${drawingId}/${sha256}.json`;
}

/**
 * Runs the Parsing of a pending Fichier source. An invalid DXF fails the Dessin
 * for good; any other error is thrown, for the queue to retry.
 */
export async function parseSource(drawingId: string, sourceKey: string): Promise<void> {
  const started = await db
    .update(drawing)
    .set({ status: "parsing" })
    .where(pending(drawingId, sourceKey))
    .returning({ id: drawing.id });

  if (started.length === 0) {
    logger.info({ drawingId }, "Parsing skipped: the Fichier source is no longer pending");

    return;
  }

  const bytes = await storage.file(sourceKey).bytes();
  const parsed = await parsedOrRejected(drawingId, sourceKey, bytes);

  if (parsed === null) {
    return;
  }

  const sha256 = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const key = parsedKey(drawingId, sha256);
  await storage.write(key, JSON.stringify(parsed), { type: "application/json" });

  // A single UPDATE: the whole Résumé and the new revision switch at once.
  const updated = await db
    .update(drawing)
    .set({
      status: "ready",
      error: null,
      sourceKey,
      sourceFilename: sql`${drawing.pendingSourceFilename}`,
      parsedKey: key,
      sizeBytes: bytes.byteLength,
      sha256,
      dxfVersion: parsed.meta.dxfVersion,
      units: parsed.meta.units,
      extent: parsed.meta.extent,
      layers: parsed.layers,
      entityCounts: parsed.meta.entityCounts,
      pendingSourceKey: null,
      pendingSourceFilename: null,
      parsedAt: new Date(),
    })
    .where(pending(drawingId, sourceKey))
    .returning({ id: drawing.id });

  if (updated.length === 0) {
    await storage.delete(key);
    logger.info({ drawingId }, "Parsing discarded: the Fichier source is no longer pending");

    return;
  }

  logger.info({ drawingId, sha256 }, "Drawing parsed");
}

/** The Dessin parsé, or null when the Fichier source was rejected as an invalid DXF. */
async function parsedOrRejected(
  drawingId: string,
  sourceKey: string,
  bytes: Uint8Array,
): Promise<ParsedDrawing | null> {
  try {
    return parseDxf(new TextDecoder().decode(bytes));
  } catch (error) {
    if (!(error instanceof InvalidDxfError)) {
      throw error;
    }

    await rejectSource(drawingId, sourceKey, error.message);

    return null;
  }
}

/** The Fichier source is not a readable DXF: it is dropped, and the Dessin fails. */
async function rejectSource(drawingId: string, sourceKey: string, message: string): Promise<void> {
  await db
    .update(drawing)
    .set({ status: "failed", error: message, pendingSourceKey: null, pendingSourceFilename: null })
    .where(pending(drawingId, sourceKey));

  await storage.delete(sourceKey);
  logger.info({ drawingId, reason: message }, "Parsing failed: invalid DXF");
}

/**
 * The queue gave up on an infrastructure error. The Fichier source stays
 * pending, so completing the upload again queues a new Parsing.
 */
export async function abandonParsing(drawingId: string, sourceKey: string): Promise<void> {
  await db
    .update(drawing)
    .set({ status: "failed", error: "The file could not be processed, please try again later" })
    .where(pending(drawingId, sourceKey));
}
