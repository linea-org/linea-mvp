import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { spaces } from './spaces';
import { users } from './users';
import type { WorkflowDefinition } from './types';

export const workflows = pgTable('workflows', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id')
    .references(() => spaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  definition: jsonb('definition').$type<WorkflowDefinition>().default({ nodes: [], edges: [] }).notNull(),
  isTemplate: boolean('is_template').default(false).notNull(),
  isPublic: boolean('is_public').default(false).notNull(),
  version: integer('version').default(1).notNull(),
  deployedAt: timestamp('deployed_at', { withTimezone: true }),
  starred: boolean('starred').default(false).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowVersions = pgTable('workflow_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workflowId: uuid('workflow_id')
    .references(() => workflows.id, { onDelete: 'cascade' })
    .notNull(),
  version: integer('version').notNull(),
  definition: jsonb('definition').$type<WorkflowDefinition>().notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const templates = pgTable('templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  category: text('category').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  thumbnailUrl: text('thumbnail_url'),
  downloads: integer('downloads').default(0).notNull(),
  featured: boolean('featured').default(false).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  space: one(spaces, {
    fields: [workflows.spaceId],
    references: [spaces.id],
  }),
  creator: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  versions: many(workflowVersions),
}));

export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
export type Template = typeof templates.$inferSelect;
