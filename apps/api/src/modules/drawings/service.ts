import { and, desc, eq, notInArray } from "drizzle-orm";

import { db } from "../../db/client";
import { env } from "../../env";
import { ApiError } from "../../errors";
import { publishStatus, type StatusChange, subscribeToStatus } from "../../parsing/events";
import { enqueueParsing } from "../../parsing/queue";
import { dropObjects, objectSize, presignDownload, presignUpload, storage } from "../../storage";
import type {
  CreateDrawing,
  DrawingDetail,
  DrawingStatus,
  DrawingSummary,
  PatchDrawing,
  PendingUpload,
  SourceFile,
  StatusEvent,
} from "./model";
import { drawing, type DrawingRow } from "./schema";

function toSummary(row: DrawingRow): DrawingSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    error: row.error,
    sizeBytes: row.sizeBytes,
    dxfVersion: row.dxfVersion,
    units: row.units,
    extent: row.extent,
    layers: row.layers,
    entityCounts: row.entityCounts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    parsedAt: row.parsedAt,
  };
}

function notFound(): ApiError {
  return new ApiError(404, "DRAWING_NOT_FOUND", "Drawing not found");
}

// A fresh key per upload: a Remplacement never overwrites the current revision.
// Objects are found through the keys stored on the row, not through a prefix.
function newSourceKey(): string {
  return `sources/${crypto.randomUUID()}.dxf`;
}

/** Creates a Dessin awaiting the upload of its Fichier source. */
export async function createDrawing(ownerId: string, input: CreateDrawing): Promise<PendingUpload> {
  const key = newSourceKey();

  const [row] = await db
    .insert(drawing)
    .values({
      ownerId,
      name: input.name,
      status: "awaiting_upload",
      pendingSourceKey: key,
      pendingSourceFilename: input.filename,
    })
    .returning();

  if (row === undefined) {
    throw new Error("insert returned no drawing");
  }

  return { drawing: toSummary(row), uploadUrl: presignUpload(key) };
}

/** The owner's Dessins, most recent first. */
export async function listDrawings(ownerId: string): Promise<DrawingSummary[]> {
  const rows = await db
    .select()
    .from(drawing)
    .where(eq(drawing.ownerId, ownerId))
    .orderBy(desc(drawing.createdAt));

  return rows.map((row) => toSummary(row));
}

function owned(ownerId: string, id: string) {
  return and(eq(drawing.id, id), eq(drawing.ownerId, ownerId));
}

/** A Dessin of the owner; anyone else's is reported as missing. */
async function ownedRow(ownerId: string, id: string): Promise<DrawingRow> {
  const [row] = await db.select().from(drawing).where(owned(ownerId, id));

  if (row === undefined) {
    throw notFound();
  }

  return row;
}

/** The Résumé of a Dessin of the owner, with links to its current revision once there is one. */
export async function getDrawing(ownerId: string, id: string): Promise<DrawingDetail> {
  const row = await ownedRow(ownerId, id);
  const { parsedKey, sourceKey } = row;
  const revision = parsedKey !== null && sourceKey !== null;

  return {
    ...toSummary(row),
    parsedUrl: revision ? presignDownload(parsedKey) : null,
    sourceUrl: revision ? presignDownload(sourceKey) : null,
  };
}

// Statuses in which the pending Fichier source is already handed to the Parsing.
const IN_PARSING: DrawingStatus[] = ["queued", "parsing"];

function noPendingUpload(): ApiError {
  return new ApiError(409, "NO_PENDING_UPLOAD", "No upload of this drawing awaits completion");
}

/**
 * Checks that the pending Fichier source was uploaded within the size limit,
 * then queues its Parsing.
 */
export async function completeUpload(ownerId: string, id: string): Promise<DrawingSummary> {
  const row = await ownedRow(ownerId, id);
  const key = row.pendingSourceKey;

  if (key === null || IN_PARSING.includes(row.status)) {
    throw noPendingUpload();
  }

  const size = await objectSize(key);

  if (size === null) {
    throw new ApiError(409, "SOURCE_FILE_MISSING", "The file was not uploaded");
  }

  if (size > env.maxUploadBytes) {
    // Nothing will ever read it; a smaller file can still be sent to the same URL.
    await storage.delete(key);

    throw new ApiError(
      413,
      "SOURCE_FILE_TOO_LARGE",
      `The file exceeds the limit of ${env.maxUploadBytes} bytes`,
    );
  }

  // Rolled back if the job cannot be queued. The condition settles a race
  // between two concurrent completions.
  const queued = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(drawing)
      .set({ status: "queued", error: null })
      .where(
        and(
          owned(ownerId, id),
          eq(drawing.pendingSourceKey, key),
          notInArray(drawing.status, IN_PARSING),
        ),
      )
      .returning();

    if (updated === undefined) {
      throw noPendingUpload();
    }

    await enqueueParsing(id, key);

    return updated;
  });

  await publishStatus(id, queued);

  return toSummary(queued);
}

/**
 * Starts the Remplacement of the Fichier source: the current revision stays
 * served while the new file is uploaded and parsed. An upload still pending is
 * dropped, and its Parsing, if queued, will change nothing.
 */
export async function replaceSource(
  ownerId: string,
  id: string,
  input: SourceFile,
): Promise<PendingUpload> {
  const key = newSourceKey();

  // Locked: a concurrent Remplacement cannot read the same previous upload.
  const { previousKey, row } = await db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ pendingSourceKey: drawing.pendingSourceKey })
      .from(drawing)
      .where(owned(ownerId, id))
      .for("update");

    if (previous === undefined) {
      throw notFound();
    }

    const [updated] = await tx
      .update(drawing)
      .set({
        status: "awaiting_upload",
        error: null,
        pendingSourceKey: key,
        pendingSourceFilename: input.filename,
      })
      .where(owned(ownerId, id))
      .returning();

    if (updated === undefined) {
      throw new Error("update returned no drawing");
    }

    return { previousKey: previous.pendingSourceKey, row: updated };
  });

  await publishStatus(id, row);

  if (previousKey !== null) {
    await dropObjects([previousKey]);
  }

  return { drawing: toSummary(row), uploadUrl: presignUpload(key) };
}

function sameStatus(event: StatusEvent, change: StatusChange): boolean {
  return event.status === change.status && event.error === change.error;
}

/**
 * The Statut of a Dessin of the owner, then each of its changes, until `signal`
 * aborts.
 */
export async function* statusEvents(
  ownerId: string,
  id: string,
  signal: AbortSignal,
): AsyncGenerator<StatusEvent> {
  // Subscribed before the Statut is read: no change can fall in between.
  await using subscription = await subscribeToStatus(id, signal);
  const row = await ownedRow(ownerId, id);
  let current: StatusEvent = { status: row.status, error: row.error };
  let at = row.updatedAt.getTime();

  yield current;

  for await (const change of subscription) {
    // Older than what was sent: published before the Statut was read, or
    // overtaken by a change published from another process.
    if (change.at >= at && !sameStatus(current, change)) {
      current = { status: change.status, error: change.error };
      at = change.at;

      yield current;
    }
  }
}

export async function updateDrawing(
  ownerId: string,
  id: string,
  changes: PatchDrawing,
): Promise<DrawingSummary> {
  const [row] = await db
    .update(drawing)
    .set({ name: changes.name, description: changes.description })
    .where(owned(ownerId, id))
    .returning();

  if (row === undefined) {
    throw notFound();
  }

  return toSummary(row);
}
