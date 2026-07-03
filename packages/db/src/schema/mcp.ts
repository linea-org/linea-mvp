import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { vector } from "./_vector"
import { workspaces } from "./workspaces"

export const mcpAuthTypeEnum = pgEnum("mcp_auth_type", [
  "none",
  "api_key",
  "bearer",
  "oauth",
])

export const mcpServerStatusEnum = pgEnum("mcp_server_status", [
  "unknown",
  "connected",
  "error",
])

export const mcpServers = pgTable("mcp_servers", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authType: mcpAuthTypeEnum("auth_type").default("none").notNull(),
  accessTokenEncrypted: text("access_token_encrypted"),
  status: mcpServerStatusEnum("status").default("unknown").notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const mcpTools = pgTable("mcp_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  mcpServerId: uuid("mcp_server_id")
    .references(() => mcpServers.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  inputSchema: jsonb("input_schema").$type<Record<string, unknown>>(),
  embedding: vector("embedding", { dimensions: 1536 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [mcpServers.workspaceId],
    references: [workspaces.id],
  }),
  tools: many(mcpTools),
}))

export const mcpToolsRelations = relations(mcpTools, ({ one }) => ({
  server: one(mcpServers, {
    fields: [mcpTools.mcpServerId],
    references: [mcpServers.id],
  }),
}))

export type MCPServer = typeof mcpServers.$inferSelect
export type NewMCPServer = typeof mcpServers.$inferInsert
export type MCPTool = typeof mcpTools.$inferSelect
