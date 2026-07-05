CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"provider" text NOT NULL,
	"key_encrypted" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "workflow_versions_workflow_id_idx";--> statement-breakpoint
DROP INDEX "workflows_pod_id_idx";--> statement-breakpoint
DROP INDEX "execution_logs_execution_id_idx";--> statement-breakpoint
DROP INDEX "executions_workspace_id_created_at_idx";--> statement-breakpoint
DROP INDEX "executions_workflow_id_idx";--> statement-breakpoint
DROP INDEX "executions_pod_id_idx";--> statement-breakpoint
DROP INDEX "approvals_execution_id_idx";--> statement-breakpoint
DROP INDEX "audit_logs_workspace_id_created_at_idx";--> statement-breakpoint
DROP INDEX "notifications_user_id_workspace_id_idx";--> statement-breakpoint
DROP INDEX "schedules_enabled_next_run_at_idx";--> statement-breakpoint
DROP INDEX "schedules_workflow_id_idx";--> statement-breakpoint
DROP INDEX "workflow_comments_workflow_id_idx";--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "definition" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "workflows" ALTER COLUMN "definition" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "executions" ALTER COLUMN "output" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;