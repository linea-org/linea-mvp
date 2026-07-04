"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.knowledgeEntriesRelations = exports.knowledgeBasesRelations = exports.memorySessionsRelations = exports.memoriesRelations = exports.knowledgeEntries = exports.knowledgeBases = exports.memorySessions = exports.memories = exports.memoryFactTypeEnum = exports.memorySourceEnum = exports.memoryScopeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const _vector_1 = require("./_vector");
const workspaces_1 = require("./workspaces");
const users_1 = require("./users");
const workflows_1 = require("./workflows");
exports.memoryScopeEnum = (0, pg_core_1.pgEnum)("memory_scope", [
    "thread",
    "workflow",
    "user",
    "session",
]);
exports.memorySourceEnum = (0, pg_core_1.pgEnum)("memory_source", [
    "manual",
    "extracted",
    "ingested",
]);
exports.memoryFactTypeEnum = (0, pg_core_1.pgEnum)("memory_fact_type", [
    "fact",
    "preference",
    "event",
    "profile",
    "system",
]);
exports.memories = (0, pg_core_1.pgTable)("memories", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id").references(() => users_1.users.id, { onDelete: "set null" }),
    threadId: (0, pg_core_1.text)("thread_id"),
    workflowId: (0, pg_core_1.uuid)("workflow_id").references(() => workflows_1.workflows.id, {
        onDelete: "set null",
    }),
    scope: (0, exports.memoryScopeEnum)("scope").notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    embedding: (0, _vector_1.vector)("embedding", { dimensions: 768 }),
    source: (0, exports.memorySourceEnum)("source").default("manual").notNull(),
    factType: (0, exports.memoryFactTypeEnum)("fact_type"),
    eventDate: (0, pg_core_1.timestamp)("event_date", { withTimezone: true }),
    sessionKey: (0, pg_core_1.text)("session_key"),
    supersededById: (0, pg_core_1.uuid)("superseded_by_id"),
    confidence: (0, pg_core_1.real)("confidence").default(1.0).notNull(),
    metadata: (0, pg_core_1.jsonb)("metadata")
        .$type()
        .default({})
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.memorySessions = (0, pg_core_1.pgTable)("memory_sessions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    rawContent: (0, pg_core_1.text)("raw_content").notNull(),
    memoriesExtracted: (0, pg_core_1.text)("memories_extracted").array().notNull().default([]),
    memoriesUpdated: (0, pg_core_1.text)("memories_updated").array().notNull().default([]),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.knowledgeBases = (0, pg_core_1.pgTable)("knowledge_bases", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    settings: (0, pg_core_1.jsonb)("settings")
        .$type()
        .default({})
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.knowledgeEntries = (0, pg_core_1.pgTable)("knowledge_entries", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    knowledgeBaseId: (0, pg_core_1.uuid)("knowledge_base_id")
        .references(() => exports.knowledgeBases.id, { onDelete: "cascade" })
        .notNull(),
    content: (0, pg_core_1.text)("content").notNull(),
    embedding: (0, _vector_1.vector)("embedding", { dimensions: 1536 }),
    metadata: (0, pg_core_1.jsonb)("metadata")
        .$type()
        .default({})
        .notNull(),
    sourceId: (0, pg_core_1.text)("source_id"),
    chunkIndex: (0, pg_core_1.integer)("chunk_index"),
    totalChunks: (0, pg_core_1.integer)("total_chunks"),
    contentHash: (0, pg_core_1.text)("content_hash"),
    status: (0, pg_core_1.text)("status").default("indexed").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.memoriesRelations = (0, drizzle_orm_1.relations)(exports.memories, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.memories.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    user: one(users_1.users, { fields: [exports.memories.userId], references: [users_1.users.id] }),
    workflow: one(workflows_1.workflows, {
        fields: [exports.memories.workflowId],
        references: [workflows_1.workflows.id],
    }),
}));
exports.memorySessionsRelations = (0, drizzle_orm_1.relations)(exports.memorySessions, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.memorySessions.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
}));
exports.knowledgeBasesRelations = (0, drizzle_orm_1.relations)(exports.knowledgeBases, ({ one, many }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.knowledgeBases.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    entries: many(exports.knowledgeEntries),
}));
exports.knowledgeEntriesRelations = (0, drizzle_orm_1.relations)(exports.knowledgeEntries, ({ one }) => ({
    knowledgeBase: one(exports.knowledgeBases, {
        fields: [exports.knowledgeEntries.knowledgeBaseId],
        references: [exports.knowledgeBases.id],
    }),
}));
//# sourceMappingURL=memory.js.map