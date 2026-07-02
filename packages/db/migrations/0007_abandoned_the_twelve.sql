ALTER TABLE "mcp_tools" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "memories" ALTER COLUMN "embedding" SET DATA TYPE vector(768);