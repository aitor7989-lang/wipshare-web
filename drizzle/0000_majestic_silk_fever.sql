CREATE TABLE IF NOT EXISTS "clips" (
	"id" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"mime" text DEFAULT 'video/mp4' NOT NULL,
	"size_bytes" bigint,
	"r2_key" text NOT NULL,
	"duration_seconds" integer,
	CONSTRAINT "clips_status_check" CHECK ("clips"."status" IN ('pending', 'ready', 'failed'))
);
