import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
  real,
  integer,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { vector } from "./_vector.js"
import { workspaces } from "./workspaces.js"
import { users } from "./users.js"
import { workflows } from "./workflows.js"

export const memoryScopeEnum = pgEnum("memory_scope", [
  "thread",
  "workflow",
  "user",
  "session",
])
export const memorySourceEnum = pgEnum("memory_source", [
  "manual",
  "extracted",
  "ingested",
])
export const memoryFactTypeEnum = pgEnum("memory_fact_type", [
  "fact",
  "preference",
  "event",
  "profile",
  "system",
])

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  threadId: text("thread_id"),
  workflowId: uuid("workflow_id").references(() => workflows.id, {
    onDelete: "set null",
  }),
  scope: memoryScopeEnum("scope").notNull(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }),
  source: memorySourceEnum("source").default("manual").notNull(),
  factType: memoryFactTypeEnum("fact_type"),
  eventDate: timestamp("event_date", { withTimezone: true }),
  sessionKey: text("session_key"),
  supersededById: uuid("superseded_by_id"),
  confidence: real("confidence").default(1.0).notNull(),
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const memorySessions = pgTable("memory_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  rawContent: text("raw_content").notNull(),
  memoriesExtracted: text("memories_extracted").array().notNull().default([]),
  memoriesUpdated: text("memories_updated").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

/** Per-KB RAG settings. Priority: node override → kbSettings → wsSettings → default. Embedding model is locked separately below. */
export interface KnowledgeBaseSettings {
  /** Max chars per chunk (default: 1800 ≈ 512 tokens) */
  chunkSize?: number
  /** Overlap chars between adjacent chunks (default: 360 = 20%) */
  chunkOverlap?: number
  /** Minimum cosine similarity for vector hits (default: 0.75) */
  similarityThreshold?: number
  /** Phase 3: opt-in Cohere Rerank v3.5 (retrieve top-rerankTopK, return top-K) */
  enableRerank?: boolean
  /** Phase 3: candidates passed to reranker (default: 50) */
  rerankTopK?: number
  /** Phase 3: fetch neighboring chunks (X-1, X, X+1) for richer context */
  expandContext?: boolean
}

export const knowledgeBases = pgTable("knowledge_bases", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  /** Per-KB RAG settings — see KnowledgeBaseSettings */
  settings: jsonb("settings")
    .$type<KnowledgeBaseSettings>()
    .default({})
    .notNull(),
  /** Locked at creation, never mutated once the KB has entries */
  embeddingModel: text("embedding_model"),
  embeddingProvider: text("embedding_provider"),
  embeddingDimensions: integer("embedding_dimensions"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const knowledgeEntries = pgTable("knowledge_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  knowledgeBaseId: uuid("knowledge_base_id")
    .references(() => knowledgeBases.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  /** Exactly one of these is populated per row, per the owning KB's locked bucket */
  embedding768: vector("embedding_768", { dimensions: 768 }),
  embedding1536: vector("embedding_1536", { dimensions: 1536 }),
  // 3072-dim bucket deferred: pgvector caps hnsw/ivfflat indexes at 2000 dimensions
  metadata: jsonb("metadata")
    .$type<Record<string, unknown>>()
    .default({})
    .notNull(),
  sourceId: text("source_id"),
  chunkIndex: integer("chunk_index"),
  totalChunks: integer("total_chunks"),
  /** SHA-256 of content — used for deduplication before insert */
  contentHash: text("content_hash"),
  /** Ingestion lifecycle: pending → embedding → indexed | failed */
  status: text("status").default("indexed").notNull(),
  /** Populated when status='failed', surfaced via getEntryStatus */
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const memoriesRelations = relations(memories, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [memories.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [memories.userId], references: [users.id] }),
  workflow: one(workflows, {
    fields: [memories.workflowId],
    references: [workflows.id],
  }),
}))

export const memorySessionsRelations = relations(memorySessions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [memorySessions.workspaceId],
    references: [workspaces.id],
  }),
}))

export const knowledgeBasesRelations = relations(
  knowledgeBases,
  ({ one, many }) => ({
    workspace: one(workspaces, {
      fields: [knowledgeBases.workspaceId],
      references: [workspaces.id],
    }),
    entries: many(knowledgeEntries),
  })
)

export const knowledgeEntriesRelations = relations(
  knowledgeEntries,
  ({ one }) => ({
    knowledgeBase: one(knowledgeBases, {
      fields: [knowledgeEntries.knowledgeBaseId],
      references: [knowledgeBases.id],
    }),
  })
)

export type Memory = typeof memories.$inferSelect
export type NewMemory = typeof memories.$inferInsert
export type MemorySession = typeof memorySessions.$inferSelect
export type NewMemorySession = typeof memorySessions.$inferInsert
export type KnowledgeBase = typeof knowledgeBases.$inferSelect
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert

/** Valid values for knowledgeEntries.status */
export type KnowledgeEntryStatus =
  "pending" | "embedding" | "indexed" | "failed"
