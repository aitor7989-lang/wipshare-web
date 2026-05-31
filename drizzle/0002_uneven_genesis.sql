ALTER TABLE "clips" ADD COLUMN "owner_token" text;--> statement-breakpoint
ALTER TABLE "clips" ADD COLUMN "expires_at" timestamp with time zone;