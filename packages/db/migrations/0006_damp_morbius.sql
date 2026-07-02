CREATE INDEX "workflow_versions_workflow_id_idx" ON "workflow_versions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflows_pod_id_idx" ON "workflows" USING btree ("pod_id");--> statement-breakpoint
CREATE INDEX "execution_logs_execution_id_idx" ON "execution_logs" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "executions_workspace_id_created_at_idx" ON "executions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "executions_workflow_id_idx" ON "executions" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "executions_pod_id_idx" ON "executions" USING btree ("pod_id");--> statement-breakpoint
CREATE INDEX "approvals_execution_id_idx" ON "approvals" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_user_id_workspace_id_idx" ON "notifications" USING btree ("user_id","workspace_id");--> statement-breakpoint
CREATE INDEX "schedules_enabled_next_run_at_idx" ON "schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "schedules_workflow_id_idx" ON "schedules" USING btree ("workflow_id");--> statement-breakpoint
CREATE INDEX "workflow_comments_workflow_id_idx" ON "workflow_comments" USING btree ("workflow_id");