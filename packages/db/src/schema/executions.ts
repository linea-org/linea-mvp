import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces"
import { pods } from "./pods"
import { workflows } from "./workflows"
import type { NodeResult } from "./types"

export const executionStatusEnum = pgEnum("execution_status", [
  "queued",
  "running",
  "suspended",
  "completed",
  "failed",
  "cancelled",
])

export const executionTriggerEnum = pgEnum("execution_trigger", [
  "manual",
  "schedule",
  "webhook",
  "sdk",
])

export const logLevelEnum = pgEnum("log_level", [
  "debug",
  "info",
  "warn",
  "error",
])

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id").references(() => workflows.id, {
    onDelete: "set null",
  }),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  podId: uuid("pod_id").references(() => pods.id, { onDelete: "set null" }),
  status: executionStatusEnum("status").default("queued").notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
  output: jsonb("output"),
  error: text("error"),
  nodeResults: jsonb("node_results")
    .$type<Record<string, NodeResult>>()
    .default({})
    .notNull(),
  variables: jsonb("variables")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  checkpoint: jsonb("checkpoint"),
  threadId: text("thread_id"),
  tokenUsage: jsonb("token_usage").$type<{
    input: number
    output: number
    total: number
  }>(),
  triggeredBy: executionTriggerEnum("triggered_by").default("manual").notNull(),
  queueJobId: text("queue_job_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const executionLogs = pgTable("execution_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id, { onDelete: "cascade" })
    .notNull(),
  nodeId: text("node_id"),
  level: logLevelEnum("level").default("info").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  durationMs: integer("duration_ms"),
  attempt: integer("attempt").default(1).notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const executionsRelations = relations(executions, ({ one, many }) => ({
  workflow: one(workflows, {
    fields: [executions.workflowId],
    references: [workflows.id],
  }),
  workspace: one(workspaces, {
    fields: [executions.workspaceId],
    references: [workspaces.id],
  }),
  pod: one(pods, {
    fields: [executions.podId],
    references: [pods.id],
  }),
  logs: many(executionLogs),
}))

export type Execution = typeof executions.$inferSelect
export type NewExecution = typeof executions.$inferInsert
export type ExecutionLog = typeof executionLogs.$inferSelect
