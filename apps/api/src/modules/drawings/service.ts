import { and, desc, eq } from "drizzle-orm";

import { db } from "../../db/client";
import { ApiError } from "../../errors";
import { presignUpload } from "../../storage";
import type { CreatedDrawing, CreateDrawing, DrawingSummary, PatchDrawing } from "./model";
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

/** A Dessin of the owner; anyone else's is reported as missing. */
export async function getDrawing(ownerId: string, id: string): Promise<DrawingSummary> {
  const [row] = await db
    .select()
    .from(drawing)
    .where(and(eq(drawing.id, id), eq(drawing.ownerId, ownerId)));

  if (row === undefined) {
    throw notFound();
  }

  return toSummary(row);
}

export async function updateDrawing(
  ownerId: string,
  id: string,
  changes: PatchDrawing,
): Promise<DrawingSummary> {
  const [row] = await db
    .update(drawing)
    .set({ name: changes.name, description: changes.description })
    .where(and(eq(drawing.id, id), eq(drawing.ownerId, ownerId)))
    .returning();

  if (row === undefined) {
    throw notFound();
  }

  return toSummary(row);
}
