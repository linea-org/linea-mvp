"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.podsRelations = exports.pods = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspaces_1 = require("./workspaces");
exports.pods = (0, pg_core_1.pgTable)("pods", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    slug: (0, pg_core_1.text)("slug").notNull(),
    description: (0, pg_core_1.text)("description"),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [(0, pg_core_1.uniqueIndex)("pods_workspace_id_slug_idx").on(t.workspaceId, t.slug)]);
exports.podsRelations = (0, drizzle_orm_1.relations)(exports.pods, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.pods.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
}));
//# sourceMappingURL=pods.js.map