import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"
import { pods } from "./pods"
import { workspaces } from "./workspaces"
import { users } from "./users"
import { workflows } from "./workflows"
import { executions } from "./executions"

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
])

export const workflowComments = pgTable("workflow_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  nodeId: text("node_id"),
  parentId: uuid("parent_id").references(
    (): AnyPgColumn => workflowComments.id,
    { onDelete: "cascade" }
  ),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  resolved: boolean("resolved").default(false).notNull(),
  pinned: boolean("pinned").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const commentReactions = pgTable(
  "comment_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commentId: uuid("comment_id")
      .references(() => workflowComments.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("comment_reactions_unique").on(t.commentId, t.userId, t.emoji)]
)

export const workflowPresence = pgTable(
  "workflow_presence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique("workflow_presence_unique").on(t.workflowId, t.userId)]
)

export const schedules = pgTable("schedules", {
  id: uuid("id").primaryKey().defaultRandom(),
  podId: uuid("pod_id")
    .references(() => pods.id, { onDelete: "cascade" })
    .notNull(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  cronExpr: text("cron_expr").notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  input: jsonb("input").$type<Record<string, unknown>>().default({}).notNull(),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  executionId: uuid("execution_id")
    .references(() => executions.id, { onDelete: "cascade" })
    .notNull(),
  nodeId: text("node_id").notNull(),
  status: approvalStatusEnum("status").default("pending").notNull(),
  message: text("message"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  resolverId: uuid("resolver_id").references(() => users.id, {
    onDelete: "set null",
  }),
  requestedAt: timestamp("requested_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
})

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  workspaceId: uuid("workspace_id").references(() => workspaces.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  resourceUrl: text("resource_url"),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  actorId: uuid("actor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  action: text("action").notNull(),
  resourceType: text("resource_type"),
  resourceId: uuid("resource_id"),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const approvalsRelations = relations(approvals, ({ one }) => ({
  execution: one(executions, {
    fields: [approvals.executionId],
    references: [executions.id],
  }),
  resolver: one(users, {
    fields: [approvals.resolverId],
    references: [users.id],
  }),
}))

export const schedulesRelations = relations(schedules, ({ one }) => ({
  pod: one(pods, { fields: [schedules.podId], references: [pods.id] }),
  workflow: one(workflows, {
    fields: [schedules.workflowId],
    references: [workflows.id],
  }),
}))

export const workflowCommentsRelations = relations(
  workflowComments,
  ({ one, many }) => ({
    workflow: one(workflows, {
      fields: [workflowComments.workflowId],
      references: [workflows.id],
    }),
    user: one(users, {
      fields: [workflowComments.userId],
      references: [users.id],
    }),
    parent: one(workflowComments, {
      fields: [workflowComments.parentId],
      references: [workflowComments.id],
      relationName: "replies",
    }),
    replies: many(workflowComments, { relationName: "replies" }),
    reactions: many(commentReactions),
  })
)

export const commentReactionsRelations = relations(
  commentReactions,
  ({ one }) => ({
    comment: one(workflowComments, {
      fields: [commentReactions.commentId],
      references: [workflowComments.id],
    }),
    user: one(users, {
      fields: [commentReactions.userId],
      references: [users.id],
    }),
  })
)

export const workflowPresenceRelations = relations(
  workflowPresence,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [workflowPresence.workflowId],
      references: [workflows.id],
    }),
    user: one(users, {
      fields: [workflowPresence.userId],
      references: [users.id],
    }),
  })
)

export const agentChatSessions = pgTable("agent_chat_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  threadId: text("thread_id").notNull().unique(),
  title: text("title").notNull(),
  messages: jsonb("messages").$type<unknown[]>().default([]).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const agentChatSessionsRelations = relations(
  agentChatSessions,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [agentChatSessions.workspaceId],
      references: [workspaces.id],
    }),
    user: one(users, {
      fields: [agentChatSessions.userId],
      references: [users.id],
    }),
  })
)

export type Schedule = typeof schedules.$inferSelect
export type Approval = typeof approvals.$inferSelect
export type Notification = typeof notifications.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type WorkflowComment = typeof workflowComments.$inferSelect
export type CommentReaction = typeof commentReactions.$inferSelect
export type WorkflowPresence = typeof workflowPresence.$inferSelect
export type AgentChatSession = typeof agentChatSessions.$inferSelect
