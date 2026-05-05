import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { workspaces } from './workspaces';

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .references(() => workspaces.id, { onDelete: 'cascade' })
      .notNull(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('spaces_workspace_id_slug_idx').on(t.workspaceId, t.slug)],
);

export const spacesRelations = relations(spaces, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [spaces.workspaceId],
    references: [workspaces.id],
  }),
}));

export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
