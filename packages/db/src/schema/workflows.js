"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowsRelations = exports.evalRuns = exports.templateUpvotes = exports.workflowFavorites = exports.templates = exports.workflowVersions = exports.workflows = exports.workflowApiVisibilityEnum = exports.workflowLogLevelEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const pods_1 = require("./pods");
const users_1 = require("./users");
exports.workflowLogLevelEnum = (0, pg_core_1.pgEnum)("workflow_log_level", [
    "none",
    "errors",
    "info",
    "debug",
]);
exports.workflowApiVisibilityEnum = (0, pg_core_1.pgEnum)("workflow_api_visibility", [
    "api_key",
    "public",
]);
exports.workflows = (0, pg_core_1.pgTable)("workflows", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    podId: (0, pg_core_1.uuid)("pod_id")
        .references(() => pods_1.pods.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    definition: (0, pg_core_1.jsonb)("definition")
        .$type()
        .default({ nodes: [], edges: [] })
        .notNull(),
    isTemplate: (0, pg_core_1.boolean)("is_template").default(false).notNull(),
    isPublic: (0, pg_core_1.boolean)("is_public").default(false).notNull(),
    version: (0, pg_core_1.integer)("version").default(1).notNull(),
    deployedAt: (0, pg_core_1.timestamp)("deployed_at", { withTimezone: true }),
    starred: (0, pg_core_1.boolean)("starred").default(false).notNull(),
    deletedAt: (0, pg_core_1.timestamp)("deleted_at", { withTimezone: true }),
    logLevel: (0, exports.workflowLogLevelEnum)("log_level").default("info").notNull(),
    logRetentionDays: (0, pg_core_1.integer)("log_retention_days"),
    apiEnabled: (0, pg_core_1.boolean)("api_enabled").default(false).notNull(),
    apiVisibility: (0, exports.workflowApiVisibilityEnum)("api_visibility")
        .default("api_key")
        .notNull(),
    apiKey: (0, pg_core_1.text)("api_key"),
    clonedFromTemplateId: (0, pg_core_1.uuid)("cloned_from_template_id"),
    createdBy: (0, pg_core_1.uuid)("created_by").references(() => users_1.users.id, {
        onDelete: "set null",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.workflowVersions = (0, pg_core_1.pgTable)("workflow_versions", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => exports.workflows.id, { onDelete: "cascade" })
        .notNull(),
    version: (0, pg_core_1.integer)("version").notNull(),
    definition: (0, pg_core_1.jsonb)("definition").$type().notNull(),
    createdBy: (0, pg_core_1.uuid)("created_by").references(() => users_1.users.id, {
        onDelete: "set null",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.templates = (0, pg_core_1.pgTable)("templates", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    category: (0, pg_core_1.text)("category").notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    source: (0, pg_core_1.text)("source").default("community").notNull(),
    workflowId: (0, pg_core_1.uuid)("workflow_id").references(() => exports.workflows.id, {
        onDelete: "set null",
    }),
    definition: (0, pg_core_1.jsonb)("definition").$type(),
    thumbnailUrl: (0, pg_core_1.text)("thumbnail_url"),
    downloads: (0, pg_core_1.integer)("downloads").default(0).notNull(),
    views: (0, pg_core_1.integer)("views").default(0).notNull(),
    upvotes: (0, pg_core_1.integer)("upvotes").default(0).notNull(),
    featured: (0, pg_core_1.boolean)("featured").default(false).notNull(),
    prerequisites: (0, pg_core_1.jsonb)("prerequisites").$type(),
    publishedBy: (0, pg_core_1.uuid)("published_by").references(() => users_1.users.id, {
        onDelete: "cascade",
    }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.workflowFavorites = (0, pg_core_1.pgTable)("workflow_favorites", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => exports.workflows.id, { onDelete: "cascade" })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => ({ uniq: (0, pg_core_1.unique)().on(t.userId, t.workflowId) }));
exports.templateUpvotes = (0, pg_core_1.pgTable)("template_upvotes", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    userId: (0, pg_core_1.uuid)("user_id")
        .references(() => users_1.users.id, { onDelete: "cascade" })
        .notNull(),
    templateId: (0, pg_core_1.uuid)("template_id")
        .references(() => exports.templates.id, { onDelete: "cascade" })
        .notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => ({ uniq: (0, pg_core_1.unique)().on(t.userId, t.templateId) }));
exports.evalRuns = (0, pg_core_1.pgTable)("eval_runs", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => exports.workflows.id, { onDelete: "cascade" })
        .notNull(),
    podId: (0, pg_core_1.uuid)("pod_id")
        .references(() => pods_1.pods.id, { onDelete: "cascade" })
        .notNull(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id").notNull(),
    results: (0, pg_core_1.jsonb)("results").notNull(),
    passCount: (0, pg_core_1.integer)("pass_count").notNull(),
    totalCount: (0, pg_core_1.integer)("total_count").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.workflowsRelations = (0, drizzle_orm_1.relations)(exports.workflows, ({ one, many }) => ({
    pod: one(pods_1.pods, {
        fields: [exports.workflows.podId],
        references: [pods_1.pods.id],
    }),
    creator: one(users_1.users, {
        fields: [exports.workflows.createdBy],
        references: [users_1.users.id],
    }),
    versions: many(exports.workflowVersions),
}));
//# sourceMappingURL=workflows.js.map