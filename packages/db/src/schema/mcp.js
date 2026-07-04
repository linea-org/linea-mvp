"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpToolsRelations = exports.mcpServersRelations = exports.mcpTools = exports.mcpServers = exports.mcpServerStatusEnum = exports.mcpAuthTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const _vector_1 = require("./_vector");
const workspaces_1 = require("./workspaces");
exports.mcpAuthTypeEnum = (0, pg_core_1.pgEnum)("mcp_auth_type", [
    "none",
    "api_key",
    "bearer",
    "oauth",
]);
exports.mcpServerStatusEnum = (0, pg_core_1.pgEnum)("mcp_server_status", [
    "unknown",
    "connected",
    "error",
]);
exports.mcpServers = (0, pg_core_1.pgTable)("mcp_servers", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    url: (0, pg_core_1.text)("url").notNull(),
    authType: (0, exports.mcpAuthTypeEnum)("auth_type").default("none").notNull(),
    accessTokenEncrypted: (0, pg_core_1.text)("access_token_encrypted"),
    status: (0, exports.mcpServerStatusEnum)("status").default("unknown").notNull(),
    lastCheckedAt: (0, pg_core_1.timestamp)("last_checked_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.mcpTools = (0, pg_core_1.pgTable)("mcp_tools", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    mcpServerId: (0, pg_core_1.uuid)("mcp_server_id")
        .references(() => exports.mcpServers.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    description: (0, pg_core_1.text)("description"),
    inputSchema: (0, pg_core_1.jsonb)("input_schema").$type(),
    embedding: (0, _vector_1.vector)("embedding", { dimensions: 768 }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.mcpServersRelations = (0, drizzle_orm_1.relations)(exports.mcpServers, ({ one, many }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.mcpServers.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
    tools: many(exports.mcpTools),
}));
exports.mcpToolsRelations = (0, drizzle_orm_1.relations)(exports.mcpTools, ({ one }) => ({
    server: one(exports.mcpServers, {
        fields: [exports.mcpTools.mcpServerId],
        references: [exports.mcpServers.id],
    }),
}));
//# sourceMappingURL=mcp.js.map