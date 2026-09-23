import { and, desc, eq, notInArray } from "drizzle-orm";

import { db } from "../../db/client";
import { env } from "../../env";
import { ApiError } from "../../errors";
import { enqueueParsing } from "../../parsing/queue";
import { objectSize, presignDownload, presignUpload, storage } from "../../storage";
import type {
  CreatedDrawing,
  CreateDrawing,
  DrawingDetail,
  DrawingStatus,
  DrawingSummary,
  PatchDrawing,
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
export async function createDrawing(
  ownerId: string,
  input: CreateDrawing,
): Promise<CreatedDrawing> {
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
  return db.transaction(async (tx) => {
    const [queued] = await tx
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

    if (queued === undefined) {
      throw noPendingUpload();
    }

    await enqueueParsing(id, key);

    return toSummary(queued);
  });
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
