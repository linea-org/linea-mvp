CREATE TABLE "eval_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workflow_id" uuid NOT NULL REFERENCES "workflows"("id") ON DELETE CASCADE,
  "pod_id" uuid NOT NULL REFERENCES "pods"("id") ON DELETE CASCADE,
  "workspace_id" uuid NOT NULL,
  "results" jsonb NOT NULL,
  "pass_count" integer NOT NULL,
  "total_count" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "eval_runs_workflow_idx" ON "eval_runs" ("workflow_id", "created_at" DESC);
CREATE INDEX "eval_runs_workspace_idx" ON "eval_runs" ("workspace_id", "created_at" DESC);
