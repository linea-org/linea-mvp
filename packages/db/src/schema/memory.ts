import { pgTable, text, timestamp, uuid, jsonb, pgEnum, real, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { vector } from './_vector';
import { workspaces } from './workspaces';
import { users } from './users';
import { workflows } from './workflows';

export const memoryScopeEnum = pgEnum('memory_scope', ['thread', 'workflow', 'user', 'session']);
export const memorySourceEnum = pgEnum('memory_source', ['manual', 'extracted', 'ingested']);
export const memoryFactTypeEnum = pgEnum('memory_fact_type', ['fact', 'preference', 'event', 'profile', 'system']);

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  threadId: text('thread_id'),
  workflowId: uuid('workflow_id').references(() => workflows.id, { onDelete: 'set null' }),
  scope: memoryScopeEnum('scope').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  source: memorySourceEnum('source').default('manual').notNull(),
  factType: memoryFactTypeEnum('fact_type'),
  eventDate: timestamp('event_date', { withTimezone: true }),
  sessionKey: text('session_key'),
  supersededById: uuid('superseded_by_id'),
  confidence: real('confidence').default(1.0).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memorySessions = pgTable('memory_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  rawContent: text('raw_content').notNull(),
  memoriesExtracted: text('memories_extracted').array().notNull().default([]),
  memoriesUpdated: text('memories_updated').array().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeBases = pgTable('knowledge_bases', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const knowledgeEntries = pgTable('knowledge_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  knowledgeBaseId: uuid('knowledge_base_id')
    .references(() => knowledgeBases.id, { onDelete: 'cascade' })
    .notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1536 }),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  sourceId: text('source_id'),
  chunkIndex: integer('chunk_index'),
  totalChunks: integer('total_chunks'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const memoriesRelations = relations(memories, ({ one }) => ({
  workspace: one(workspaces, { fields: [memories.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [memories.userId], references: [users.id] }),
  workflow: one(workflows, { fields: [memories.workflowId], references: [workflows.id] }),
}));

export const memorySessionsRelations = relations(memorySessions, ({ one }) => ({
  workspace: one(workspaces, { fields: [memorySessions.workspaceId], references: [workspaces.id] }),
}));

export const knowledgeBasesRelations = relations(knowledgeBases, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [knowledgeBases.workspaceId], references: [workspaces.id] }),
  entries: many(knowledgeEntries),
}));

export const knowledgeEntriesRelations = relations(knowledgeEntries, ({ one }) => ({
  knowledgeBase: one(knowledgeBases, { fields: [knowledgeEntries.knowledgeBaseId], references: [knowledgeBases.id] }),
}));

export type Memory = typeof memories.$inferSelect;
export type NewMemory = typeof memories.$inferInsert;
export type MemorySession = typeof memorySessions.$inferSelect;
export type NewMemorySession = typeof memorySessions.$inferInsert;
export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect;
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert;
