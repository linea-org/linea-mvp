import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces"
import { pods } from "./pods"
import { users } from "./users"
import { workflows } from "./workflows"

export const oauthConnections = pgTable("oauth_connections", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
<<<<<<< HEAD
  provider: text("provider").notNull(), // google, slack, github, notion
  accessTokenEncrypted: text("access_token_encrypted").notNull(),
  refreshTokenEncrypted: text("refresh_token_encrypted"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  scope: text("scope"),
  providerUserId: text("provider_user_id"),
  providerEmail: text("provider_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
=======
  provider: text('provider').notNull(), // google, slack, github, notion
  accessTokenEncrypted: text('access_token_encrypted').notNull(),
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  scope: text('scope'),
  providerUserId: text('provider_user_id'),
  providerEmail: text('provider_email'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const oauthConnectionsRelations = relations(oauthConnections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [oauthConnections.workspaceId],
    references: [workspaces.id],
  }),
}));

export type OAuthConnection = typeof oauthConnections.$inferSelect;
export type NewOAuthConnection = typeof oauthConnections.$inferInsert;

export const secrets = pgTable('secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
    .notNull(),
})

export const oauthConnectionsRelations = relations(
  oauthConnections,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [oauthConnections.workspaceId],
      references: [workspaces.id],
    }),
  })
)

export type OAuthConnection = typeof oauthConnections.$inferSelect
export type NewOAuthConnection = typeof oauthConnections.$inferInsert

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  keyEncrypted: text("key_encrypted").notNull(),
  label: text("label"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const secrets = pgTable("secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  valueEncrypted: text("value_encrypted").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// Keys issued to SDK / programmatic API consumers
export const lineaApiKeys = pgTable("linea_api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  keyHash: text("key_hash").unique().notNull(),
  label: text("label"),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const webhooks = pgTable("webhooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  podId: uuid("pod_id")
    .references(() => pods.id, { onDelete: "cascade" })
    .notNull(),
  workflowId: uuid("workflow_id")
    .references(() => workflows.id, { onDelete: "cascade" })
    .notNull(),
  /** @deprecated use secretEncrypted — kept for zero-downtime migration only */
  secretToken: text("secret_token").notNull().default(""),
  /** AES-256-GCM encrypted secret: base64(iv[12] + authTag[16] + ciphertext) */
  secretEncrypted: text("secret_encrypted"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

<<<<<<< HEAD
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}))

=======
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
export const lineaApiKeysRelations = relations(lineaApiKeys, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [lineaApiKeys.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [lineaApiKeys.userId], references: [users.id] }),
}))

<<<<<<< HEAD
export type ApiKey = typeof apiKeys.$inferSelect
export type Secret = typeof secrets.$inferSelect
export type LineaApiKey = typeof lineaApiKeys.$inferSelect
export type Webhook = typeof webhooks.$inferSelect
=======
export type Secret = typeof secrets.$inferSelect;
export type LineaApiKey = typeof lineaApiKeys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
>>>>>>> bfb8587 (LIN-53: Codebase cleanup - split oversized files, fix AI-slop patterns, audit fixes (#117))
