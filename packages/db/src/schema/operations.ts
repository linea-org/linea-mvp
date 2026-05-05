import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  pgEnum,
  numeric,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { spaces } from './spaces';
import { workspaces } from './workspaces';
import { users } from './users';
import { workflows } from './workflows';
import { executions } from './executions';

export const approvalStatusEnum = pgEnum('approval_status', [
  'pending',
  'approved',
  'rejected',
]);

export const schedules = pgTable('schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id')
    .references(() => spaces.id, { onDelete: 'cascade' })
    .notNull(),
  workflowId: uuid('workflow_id')
    .references(() => workflows.id, { onDelete: 'cascade' })
    .notNull(),
  cronExpr: text('cron_expr').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}).notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  executionId: uuid('execution_id')
    .references(() => executions.id, { onDelete: 'cascade' })
    .notNull(),
  nodeId: text('node_id').notNull(),
  status: approvalStatusEnum('status').default('pending').notNull(),
  message: text('message'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  resolverId: uuid('resolver_id').references(() => users.id, { onDelete: 'set null' }),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body'),
  read: boolean('read').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  resourceType: text('resource_type'),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const approvalsRelations = relations(approvals, ({ one }) => ({
  execution: one(executions, { fields: [approvals.executionId], references: [executions.id] }),
  resolver: one(users, { fields: [approvals.resolverId], references: [users.id] }),
}));

export const schedulesRelations = relations(schedules, ({ one }) => ({
  space: one(spaces, { fields: [schedules.spaceId], references: [spaces.id] }),
  workflow: one(workflows, { fields: [schedules.workflowId], references: [workflows.id] }),
}));

export type Schedule = typeof schedules.$inferSelect;
export type Approval = typeof approvals.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
