"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executionsRelations = exports.executionLogs = exports.executions = exports.logLevelEnum = exports.executionTriggerEnum = exports.executionStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspaces_1 = require("./workspaces");
const pods_1 = require("./pods");
const workflows_1 = require("./workflows");
exports.executionStatusEnum = (0, pg_core_1.pgEnum)("execution_status", [
    "queued",
    "running",
    "suspended",
    "completed",
    "failed",
    "cancelled",
]);
exports.executionTriggerEnum = (0, pg_core_1.pgEnum)("execution_trigger", [
    "manual",
    "schedule",
    "webhook",
    "sdk",
]);
exports.logLevelEnum = (0, pg_core_1.pgEnum)("log_level", [
    "debug",
    "info",
    "warn",
    "error",
]);
exports.executions = (0, pg_core_1.pgTable)("executions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workflowId: (0, pg_core_1.uuid)("workflow_id").references(() => workflows_1.workflows.id, {
        onDelete: "set null",
    }),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    podId: (0, pg_core_1.uuid)("pod_id").references(() => pods_1.pods.id, { onDelete: "set null" }),
    status: (0, exports.executionStatusEnum)("status").default("queued").notNull(),
    input: (0, pg_core_1.jsonb)("input").$type().default({}).notNull(),
    output: (0, pg_core_1.jsonb)("output"),
    error: (0, pg_core_1.text)("error"),
    nodeResults: (0, pg_core_1.jsonb)("node_results")
        .$type()
        .default({})
        .notNull(),
    variables: (0, pg_core_1.jsonb)("variables")
        .$type()
        .default({})
        .notNull(),
    checkpoint: (0, pg_core_1.jsonb)("checkpoint"),
    threadId: (0, pg_core_1.text)("thread_id"),
    tokenUsage: (0, pg_core_1.jsonb)("token_usage").$type(),
    triggeredBy: (0, exports.executionTriggerEnum)("triggered_by").default("manual").notNull(),
    queueJobId: (0, pg_core_1.text)("queue_job_id"),
    startedAt: (0, pg_core_1.timestamp)("started_at", { withTimezone: true }),
    finishedAt: (0, pg_core_1.timestamp)("finished_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.executionLogs = (0, pg_core_1.pgTable)("execution_logs", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    executionId: (0, pg_core_1.uuid)("execution_id")
        .references(() => exports.executions.id, { onDelete: "cascade" })
        .notNull(),
    nodeId: (0, pg_core_1.text)("node_id"),
    level: (0, exports.logLevelEnum)("level").default("info").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    data: (0, pg_core_1.jsonb)("data"),
    durationMs: (0, pg_core_1.integer)("duration_ms"),
    attempt: (0, pg_core_1.integer)("attempt").default(1).notNull(),
    timestamp: (0, pg_core_1.timestamp)("timestamp", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.executionsRelations = (0, drizzle_orm_1.relations)(exports.executions, ({ one, many }) => ({
    workflow: one(workflows_1.workflows, {
        fields: [exports.executions.workflowId],
        references: [workflows_1.workflows.id],
    }),
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.executions.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    pod: one(pods_1.pods, {
        fields: [exports.executions.podId],
        references: [pods_1.pods.id],
    }),
    logs: many(exports.executionLogs),
}));
//# sourceMappingURL=executions.js.map