import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { workspaces } from "./workspaces.js"
import { boolean } from "drizzle-orm/pg-core"
import { unique } from "drizzle-orm/pg-core"
import { integer } from "drizzle-orm/pg-core"

export const providerConnections = pgTable(
  "provider_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").notNull(), // 'openai', 'slack', 'github'
    authType: text("auth_type").notNull(), // 'api_key' | 'oauth' | 'service_token'

    configEncrypted: text("config_encrypted").notNull(), // AES-encrypted JSON blob
    encryptionKeyVersion: integer("encryption_key_Version")
      .notNull()
      .default(1),
    encryptionIV: text("encryption_iv").notNull(),
    encryptionAuthTag: text("encryption_auth_tag").notNull(),

    providerUserId: text("provider_user_id"),
    providerEmail: text("provider_email"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [unique().on(t.workspaceId, t.provider)]
)

export type ProviderConnection = typeof providerConnections.$inferSelect
export type NewProviderConnection = typeof providerConnections.$inferInsert
