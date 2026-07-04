"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lineaApiKeysRelations = exports.apiKeysRelations = exports.webhooks = exports.lineaApiKeys = exports.secrets = exports.apiKeys = exports.oauthConnectionsRelations = exports.oauthConnections = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspaces_1 = require("./workspaces");
const pods_1 = require("./pods");
const users_1 = require("./users");
const workflows_1 = require("./workflows");
exports.oauthConnections = (0, pg_core_1.pgTable)("oauth_connections", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    accessTokenEncrypted: (0, pg_core_1.text)("access_token_encrypted").notNull(),
    refreshTokenEncrypted: (0, pg_core_1.text)("refresh_token_encrypted"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }),
    scope: (0, pg_core_1.text)("scope"),
    providerUserId: (0, pg_core_1.text)("provider_user_id"),
    providerEmail: (0, pg_core_1.text)("provider_email"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.oauthConnectionsRelations = (0, drizzle_orm_1.relations)(exports.oauthConnections, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.oauthConnections.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
}));
exports.apiKeys = (0, pg_core_1.pgTable)("api_keys", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id").references(() => users_1.users.id, { onDelete: "set null" }),
    provider: (0, pg_core_1.text)("provider").notNull(),
    keyEncrypted: (0, pg_core_1.text)("key_encrypted").notNull(),
    label: (0, pg_core_1.text)("label"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.secrets = (0, pg_core_1.pgTable)("secrets", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    valueEncrypted: (0, pg_core_1.text)("value_encrypted").notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.lineaApiKeys = (0, pg_core_1.pgTable)("linea_api_keys", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id").references(() => users_1.users.id, { onDelete: "set null" }),
    keyHash: (0, pg_core_1.text)("key_hash").unique().notNull(),
    label: (0, pg_core_1.text)("label"),
    lastUsedAt: (0, pg_core_1.timestamp)("last_used_at", { withTimezone: true }),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }),
    revokedAt: (0, pg_core_1.timestamp)("revoked_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.webhooks = (0, pg_core_1.pgTable)("webhooks", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    podId: (0, pg_core_1.uuid)("pod_id")
        .references(() => pods_1.pods.id, { onDelete: "cascade" })
        .notNull(),
    workflowId: (0, pg_core_1.uuid)("workflow_id")
        .references(() => workflows_1.workflows.id, { onDelete: "cascade" })
        .notNull(),
    secretToken: (0, pg_core_1.text)("secret_token").notNull().default(""),
    secretEncrypted: (0, pg_core_1.text)("secret_encrypted"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.apiKeysRelations = (0, drizzle_orm_1.relations)(exports.apiKeys, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.apiKeys.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    user: one(users_1.users, { fields: [exports.apiKeys.userId], references: [users_1.users.id] }),
}));
exports.lineaApiKeysRelations = (0, drizzle_orm_1.relations)(exports.lineaApiKeys, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.lineaApiKeys.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    user: one(users_1.users, { fields: [exports.lineaApiKeys.userId], references: [users_1.users.id] }),
}));
//# sourceMappingURL=integrations.js.map