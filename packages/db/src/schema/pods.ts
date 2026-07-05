import {
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces.js"

export const pods = pgTable(
  "pods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .references(() => workspaces.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("pods_workspace_id_slug_idx").on(t.workspaceId, t.slug)]
)

export const podsRelations = relations(pods, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [pods.workspaceId],
    references: [workspaces.id],
  }),
}))

export type Pod = typeof pods.$inferSelect
export type NewPod = typeof pods.$inferInsert
