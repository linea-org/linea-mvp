ALTER TABLE "templates" ADD COLUMN "source" text DEFAULT 'community' NOT NULL;--> statement-breakpoint
ALTER TABLE "templates" ADD COLUMN "prerequisites" jsonb;