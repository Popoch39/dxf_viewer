import type { EntityCounts, Extent, Layer, Units } from "@repo/dxf";
import { sql } from "drizzle-orm";
import { bigint, index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { user } from "../auth/schema";

export const DRAWING_STATUSES = [
  "awaiting_upload",
  "queued",
  "parsing",
  "ready",
  "failed",
] as const;

export const drawingStatus = pgEnum("drawing_status", DRAWING_STATUSES);

export const drawing = pgTable(
  "drawing",
  {
    // Time-ordered: new rows land at the end of the primary key index.
    id: uuid("id")
      .primaryKey()
      .default(sql`uuidv7()`),
    ownerId: text("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: drawingStatus("status").notNull(),
    // Last Parsing failure; kept next to the current revision when a Remplacement fails.
    error: text("error"),

    // Current revision: set once a Parsing succeeds.
    sourceKey: text("source_key"),
    sourceFilename: text("source_filename"),
    parsedKey: text("parsed_key"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sha256: text("sha256"),
    dxfVersion: text("dxf_version"),
    units: text("units").$type<Units>(),
    extent: jsonb("extent").$type<Extent>(),
    layers: jsonb("layers").$type<Layer[]>(),
    entityCounts: jsonb("entity_counts").$type<EntityCounts>(),

    // Pending revision: the Fichier source being uploaded or parsed.
    pendingSourceKey: text("pending_source_key"),
    pendingSourceFilename: text("pending_source_filename"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    // Set by the database clock, shared by the API and the worker: it orders
    // the changes of Statut they publish.
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => sql`now()`)
      .notNull(),
    parsedAt: timestamp("parsed_at"),
  },
  (table) => [index("drawing_owner_id_created_at_idx").on(table.ownerId, table.createdAt)],
);

export type DrawingRow = typeof drawing.$inferSelect;
