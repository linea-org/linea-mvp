"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentChatSessionsRelations = exports.agentChatSessions = exports.workflowPresenceRelations = exports.commentReactionsRelations = exports.workflowCommentsRelations = exports.schedulesRelations = exports.approvalsRelations = exports.auditLogs = exports.notifications = exports.approvals = exports.schedules = exports.workflowPresence = exports.commentReactions = exports.workflowComments = exports.approvalStatusEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const pods_1 = require("./pods");
const workspaces_1 = require("./workspaces");
const users_1 = require("./users");
const workflows_1 = require("./workflows");
const executions_1 = require("./executions");
exports.approvalStatusEnum = (0, pg_core_1.pgEnum)("approval_status", [
    "pending",
    "approved",
    "rejected",
]);
exports.workflowComments = (0, pg_core_1.pgTable)("workflow_comments", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => workflows_1.workflows.id, { onDelete: "cascade" })
        .notNull(),
    nodeId: (0, pg_core_1.text)("node_id"),
    parentId: (0, pg_core_1.uuid)("parent_id").references(() => exports.workflowComments.id, { onDelete: "cascade" }),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    body: (0, pg_core_1.text)("body").notNull(),
    resolved: (0, pg_core_1.boolean)("resolved").default(false).notNull(),
    pinned: (0, pg_core_1.boolean)("pinned").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.commentReactions = (0, pg_core_1.pgTable)("comment_reactions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    commentId: (0, pg_core_1.uuid)("comment_id")
        .references(() => exports.workflowComments.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    emoji: (0, pg_core_1.text)("emoji").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [(0, pg_core_1.unique)("comment_reactions_unique").on(t.commentId, t.userId, t.emoji)]);
exports.workflowPresence = (0, pg_core_1.pgTable)("workflow_presence", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => workflows_1.workflows.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    lastSeenAt: (0, pg_core_1.timestamp)("last_seen_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [(0, pg_core_1.unique)("workflow_presence_unique").on(t.workflowId, t.userId)]);
exports.schedules = (0, pg_core_1.pgTable)("schedules", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    podId: (0, pg_core_1.uuid)("pod_id")
        .references(() => pods_1.pods.id, { onDelete: "cascade" })
        .notNull(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => workflows_1.workflows.id, { onDelete: "cascade" })
        .notNull(),
    cronExpr: (0, pg_core_1.text)("cron_expr").notNull(),
    enabled: (0, pg_core_1.boolean)("enabled").default(true).notNull(),
    input: (0, pg_core_1.jsonb)("input").$type().default({}).notNull(),
    lastRunAt: (0, pg_core_1.timestamp)("last_run_at", { withTimezone: true }),
    nextRunAt: (0, pg_core_1.timestamp)("next_run_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.approvals = (0, pg_core_1.pgTable)("approvals", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    executionId: (0, pg_core_1.uuid)("execution_id")
        .references(() => executions_1.executions.id, { onDelete: "cascade" })
        .notNull(),
    nodeId: (0, pg_core_1.text)("node_id").notNull(),
    status: (0, exports.approvalStatusEnum)("status").default("pending").notNull(),
    message: (0, pg_core_1.text)("message"),
    metadata: (0, pg_core_1.jsonb)("metadata")
        .$type()
        .default({})
        .notNull(),
    resolverId: (0, pg_core_1.uuid)("resolver_id").references(() => users_1.users.id, {
        onDelete: "set null",
    }),
    requestedAt: (0, pg_core_1.timestamp)("requested_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    resolvedAt: (0, pg_core_1.timestamp)("resolved_at", { withTimezone: true }),
});
exports.notifications = (0, pg_core_1.pgTable)("notifications", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id").references(() => workspaces_1.workspaces.id, {
        onDelete: "cascade",
    }),
    type: (0, pg_core_1.text)("type").notNull(),
    title: (0, pg_core_1.text)("title").notNull(),
    body: (0, pg_core_1.text)("body"),
    resourceUrl: (0, pg_core_1.text)("resource_url"),
    read: (0, pg_core_1.boolean)("read").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.auditLogs = (0, pg_core_1.pgTable)("audit_logs", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    actorId: (0, pg_core_1.uuid)("actor_id").references(() => users_1.users.id, {
        onDelete: "set null",
    }),
    action: (0, pg_core_1.text)("action").notNull(),
    resourceType: (0, pg_core_1.text)("resource_type"),
    resourceId: (0, pg_core_1.uuid)("resource_id"),
    metadata: (0, pg_core_1.jsonb)("metadata")
        .$type()
        .default({})
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.approvalsRelations = (0, drizzle_orm_1.relations)(exports.approvals, ({ one }) => ({
    execution: one(executions_1.executions, {
        fields: [exports.approvals.executionId],
        references: [executions_1.executions.id],
    }),
    resolver: one(users_1.users, {
        fields: [exports.approvals.resolverId],
        references: [users_1.users.id],
    }),
}));
exports.schedulesRelations = (0, drizzle_orm_1.relations)(exports.schedules, ({ one }) => ({
    pod: one(pods_1.pods, { fields: [exports.schedules.podId], references: [pods_1.pods.id] }),
    workflow: one(workflows_1.workflows, {
        fields: [exports.schedules.workflowId],
        references: [workflows_1.workflows.id],
    }),
}));
exports.workflowCommentsRelations = (0, drizzle_orm_1.relations)(exports.workflowComments, ({ one, many }) => ({
    workflow: one(workflows_1.workflows, {
        fields: [exports.workflowComments.workflowId],
        references: [workflows_1.workflows.id],
    }),
    user: one(users_1.users, {
        fields: [exports.workflowComments.userId],
        references: [users_1.users.id],
    }),
    parent: one(exports.workflowComments, {
        fields: [exports.workflowComments.parentId],
        references: [exports.workflowComments.id],
        relationName: "replies",
    }),
    replies: many(exports.workflowComments, { relationName: "replies" }),
    reactions: many(exports.commentReactions),
}));
exports.commentReactionsRelations = (0, drizzle_orm_1.relations)(exports.commentReactions, ({ one }) => ({
    comment: one(exports.workflowComments, {
        fields: [exports.commentReactions.commentId],
        references: [exports.workflowComments.id],
    }),
    user: one(users_1.users, {
        fields: [exports.commentReactions.userId],
        references: [users_1.users.id],
    }),
}));
exports.workflowPresenceRelations = (0, drizzle_orm_1.relations)(exports.workflowPresence, ({ one }) => ({
    workflow: one(workflows_1.workflows, {
        fields: [exports.workflowPresence.workflowId],
        references: [workflows_1.workflows.id],
    }),
    user: one(users_1.users, {
        fields: [exports.workflowPresence.userId],
        references: [users_1.users.id],
    }),
}));
exports.agentChatSessions = (0, pg_core_1.pgTable)("agent_chat_sessions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id").references(() => users_1.users.id, { onDelete: "set null" }),
    threadId: (0, pg_core_1.text)("thread_id").notNull().unique(),
    title: (0, pg_core_1.text)("title").notNull(),
    messages: (0, pg_core_1.jsonb)("messages").$type().default([]).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.agentChatSessionsRelations = (0, drizzle_orm_1.relations)(exports.agentChatSessions, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.agentChatSessions.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    user: one(users_1.users, {
        fields: [exports.agentChatSessions.userId],
        references: [users_1.users.id],
    }),
}));
//# sourceMappingURL=operations.js.map