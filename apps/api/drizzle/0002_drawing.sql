CREATE TYPE "public"."drawing_status" AS ENUM('awaiting_upload', 'queued', 'parsing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "drawing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "drawing_status" NOT NULL,
	"error" text,
	"source_key" text,
	"source_filename" text,
	"parsed_key" text,
	"size_bytes" bigint,
	"sha256" text,
	"dxf_version" text,
	"units" text,
	"extent" jsonb,
	"layers" jsonb,
	"entity_counts" jsonb,
	"pending_source_key" text,
	"pending_source_filename" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"parsed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "drawing_owner_id_created_at_idx" ON "drawing" USING btree ("owner_id","created_at");