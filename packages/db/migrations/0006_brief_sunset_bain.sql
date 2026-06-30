ALTER TABLE "schedules" ADD COLUMN "last_error" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;