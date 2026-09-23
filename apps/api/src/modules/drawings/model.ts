import { DXF_UNITS, EntityCounts, Extent, Layer } from "@repo/dxf";
import { t } from "elysia";

import { env } from "../../env";
import { DRAWING_STATUSES } from "./schema";

export const DrawingStatus = t.UnionEnum(DRAWING_STATUSES);

export type DrawingStatus = typeof DrawingStatus.static;

/** An event of the Statut stream: the Statut of the Dessin, and its last Parsing error. */
export const StatusEvent = t.Object({
  status: DrawingStatus,
  error: t.Nullable(t.String()),
});

export type StatusEvent = typeof StatusEvent.static;

/** A server-sent event of the Statut stream. */
export const StatusEventMessage = t.Object({ event: t.Literal("status"), data: StatusEvent });

export type StatusEventMessage = typeof StatusEventMessage.static;

/** Résumé of a Dessin: everything but the geometry. Revision fields stay null until a Parsing succeeds. */
export const DrawingSummary = t.Object({
  id: t.String({ format: "uuid" }),
  name: t.String(),
  description: t.Nullable(t.String()),
  status: DrawingStatus,
  error: t.Nullable(t.String()),
  sizeBytes: t.Nullable(t.Integer()),
  dxfVersion: t.Nullable(t.String()),
  units: t.Nullable(t.UnionEnum(DXF_UNITS)),
  extent: t.Nullable(Extent),
  layers: t.Nullable(t.Array(Layer)),
  entityCounts: t.Nullable(EntityCounts),
  createdAt: t.Date(),
  updatedAt: t.Date(),
  parsedAt: t.Nullable(t.Date()),
});

export type DrawingSummary = typeof DrawingSummary.static;

/** Résumé of one Dessin, with presigned, short-lived GET URLs to its current revision, if any. */
export const DrawingDetail = t.Composite([
  DrawingSummary,
  t.Object({
    /** The Dessin parsé, as JSON. */
    parsedUrl: t.Nullable(t.String()),
    /** The Fichier source, as uploaded. */
    sourceUrl: t.Nullable(t.String()),
  }),
]);

export type DrawingDetail = typeof DrawingDetail.static;

const Name = t.String({ minLength: 1, maxLength: 200 });

const Description = t.Nullable(t.String({ maxLength: 2000 }));

/** The Fichier source about to be uploaded. */
export const SourceFile = t.Object({
  filename: t.String({ minLength: 1, maxLength: 255 }),
  // Declared by the client and checked up front; the stored object's real size
  // is checked again when the upload completes, since a PUT URL cannot cap it.
  sizeBytes: t.Integer({ minimum: 1, maximum: env.maxUploadBytes }),
});

export type SourceFile = typeof SourceFile.static;

export const CreateDrawing = t.Composite([t.Object({ name: Name }), SourceFile]);

export type CreateDrawing = typeof CreateDrawing.static;

/** A Dessin awaiting the upload of a Fichier source. */
export const PendingUpload = t.Object({
  drawing: DrawingSummary,
  /** Presigned, short-lived PUT URL for the Fichier source. */
  uploadUrl: t.String(),
});

export type PendingUpload = typeof PendingUpload.static;

export const PatchDrawing = t.Object(
  { name: t.Optional(Name), description: t.Optional(Description) },
  { minProperties: 1 },
);

export type PatchDrawing = typeof PatchDrawing.static;

export const DrawingParams = t.Object({ id: t.String({ format: "uuid" }) });

export type DrawingParams = typeof DrawingParams.static;
