ALTER TABLE "clips" ADD COLUMN "visibility" text DEFAULT 'public' NOT NULL;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "clips" ADD CONSTRAINT "clips_visibility_check" CHECK ("clips"."visibility" IN ('public', 'private'));