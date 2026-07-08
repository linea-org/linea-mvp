ALTER TABLE "knowledge_bases" ADD COLUMN "embedding_model" text;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "embedding_provider" text;--> statement-breakpoint
ALTER TABLE "knowledge_bases" ADD COLUMN "embedding_dimensions" integer;--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "embedding_768" vector(768);--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "embedding_1536" vector(1536);--> statement-breakpoint
ALTER TABLE "knowledge_entries" ADD COLUMN "last_error" text;