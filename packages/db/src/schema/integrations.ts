import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';
import { spaces } from './spaces';
import { users } from './users';
import { workflows } from './workflows';

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  provider: text('provider').notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const secrets = pgTable('secrets', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  name: text('name').notNull(),
  valueEncrypted: text('value_encrypted').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Keys issued to SDK / programmatic API consumers
export const lineaApiKeys = pgTable('linea_api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .references(() => workspaces.id, { onDelete: 'cascade' })
    .notNull(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  keyHash: text('key_hash').unique().notNull(),
  label: text('label'),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id')
    .references(() => spaces.id, { onDelete: 'cascade' })
    .notNull(),
  workflowId: uuid('workflow_id')
    .references(() => workflows.id, { onDelete: 'cascade' })
    .notNull(),
  secretToken: text('secret_token').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  workspace: one(workspaces, { fields: [apiKeys.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const lineaApiKeysRelations = relations(lineaApiKeys, ({ one }) => ({
  workspace: one(workspaces, { fields: [lineaApiKeys.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [lineaApiKeys.userId], references: [users.id] }),
}));

export type ApiKey = typeof apiKeys.$inferSelect;
export type Secret = typeof secrets.$inferSelect;
export type LineaApiKey = typeof lineaApiKeys.$inferSelect;
export type Webhook = typeof webhooks.$inferSelect;
