import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  boolean,
  integer,
  unique,
  pgEnum,
<<<<<<< HEAD
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { pods } from "./pods"
import { users } from "./users"
import type { WorkflowDefinition } from "./types"
=======
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { pods } from './pods';
import { users } from './users';
import type { WorkflowDefinition } from './types';
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

export const workflowLogLevelEnum = pgEnum("workflow_log_level", [
  "none",
  "errors",
  "info",
  "debug",
])

export const workflowApiVisibilityEnum = pgEnum("workflow_api_visibility", [
  "api_key",
  "public",
])

<<<<<<< HEAD
export const workflows = pgTable("workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  podId: uuid("pod_id")
    .references(() => pods.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition")
    .$type<WorkflowDefinition>()
    .default({ nodes: [], edges: [] })
    .notNull(),
  isTemplate: boolean("is_template").default(false).notNull(),
  isPublic: boolean("is_public").default(false).notNull(),
  version: integer("version").default(1).notNull(),
  deployedAt: timestamp("deployed_at", { withTimezone: true }),
  starred: boolean("starred").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  logLevel: workflowLogLevelEnum("log_level").default("info").notNull(),
  logRetentionDays: integer("log_retention_days"),
  apiEnabled: boolean("api_enabled").default(false).notNull(),
  apiVisibility: workflowApiVisibilityEnum("api_visibility")
    .default("api_key")
    .notNull(),
  apiKey: text("api_key"),
  /** Set when a workflow is cloned from a template; used to prevent publishing unmodified clones. */
  clonedFromTemplateId: uuid("cloned_from_template_id"),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})
=======
export const workflows = pgTable(
  'workflows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    podId: uuid('pod_id')
      .references(() => pods.id, { onDelete: 'cascade' })
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
    logLevel: workflowLogLevelEnum('log_level').default('info').notNull(),
    logRetentionDays: integer('log_retention_days'),
    apiEnabled: boolean('api_enabled').default(false).notNull(),
    apiVisibility: workflowApiVisibilityEnum('api_visibility').default('api_key').notNull(),
    apiKey: text('api_key'),
    /** Set when a workflow is cloned from a template; used to prevent publishing unmodified clones. */
    clonedFromTemplateId: uuid('cloned_from_template_id'),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('workflows_pod_id_idx').on(t.podId)],
);

export const workflowVersions = pgTable(
  'workflow_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workflowId: uuid('workflow_id')
      .references(() => workflows.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    definition: jsonb('definition').$type<WorkflowDefinition>().notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index('workflow_versions_workflow_id_idx').on(t.workflowId)],
);
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))

export const workflowVersions = pgTable("workflow_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  version: integer("version").notNull(),
  definition: jsonb("definition").$type<WorkflowDefinition>().notNull(),
  createdBy: uuid("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const templates = pgTable("templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  category: text("category").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** 'internal' = built-in (no upvotes/download count shown), 'community' = user-published */
  source: text("source").default("community").notNull(),
  workflowId: uuid("workflow_id").references(() => workflows.id, {
    onDelete: "set null",
  }),
  definition: jsonb("definition").$type<WorkflowDefinition>(),
  thumbnailUrl: text("thumbnail_url"),
  downloads: integer("downloads").default(0).notNull(),
  views: integer("views").default(0).notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  featured: boolean("featured").default(false).notNull(),
  /**
   * Prerequisites a user must set up before using this template.
   * Each item: { type: string; label: string; description: string }
   * e.g. { type: 'rag', label: 'Knowledge Base', description: 'Create a KB and copy its ID.' }
   */
  prerequisites:
    jsonb("prerequisites").$type<
      Array<{ type: string; label: string; description: string }>
    >(),
  /**
   * The user who published this template to the gallery.
   * NULL is only valid for source = 'internal' (seeder-created built-ins).
   * Community templates must always have a publisher; cascading delete removes
   * the template when the publisher's account is deleted.
   */
  publishedBy: uuid("published_by").references(() => users.id, {
    onDelete: "cascade",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Per-user workflow bookmarks (replaces the team-wide starred boolean for personal saves)
export const workflowFavorites = pgTable(
  "workflow_favorites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    workflowId: uuid("workflow_id")
      .references(() => workflows.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.workflowId) })
)

// Template upvotes — one per user per template, toggleable
export const templateUpvotes = pgTable(
  "template_upvotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    templateId: uuid("template_id")
      .references(() => templates.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.templateId) })
)

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  podId: uuid("pod_id")
    .references(() => pods.id, { onDelete: "cascade" })
    .notNull(),
  workspaceId: uuid("workspace_id").notNull(),
  results: jsonb("results").notNull(),
  passCount: integer("pass_count").notNull(),
  totalCount: integer("total_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  pod: one(pods, {
    fields: [workflows.podId],
    references: [pods.id],
  }),
  creator: one(users, {
    fields: [workflows.createdBy],
    references: [users.id],
  }),
  versions: many(workflowVersions),
}))

export type Workflow = typeof workflows.$inferSelect
export type NewWorkflow = typeof workflows.$inferInsert
export type WorkflowVersion = typeof workflowVersions.$inferSelect
export type Template = typeof templates.$inferSelect
export type WorkflowFavorite = typeof workflowFavorites.$inferSelect
export type TemplateUpvote = typeof templateUpvotes.$inferSelect
export type EvalRun = typeof evalRuns.$inferSelect
