"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceMembersRelations = exports.workspacesRelations = exports.workspaceInvites = exports.workspaceMembers = exports.workspaces = exports.workspaceMemberRoleEnum = exports.workspacePlanEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.workspacePlanEnum = (0, pg_core_1.pgEnum)("workspace_plan", [
    "free",
    "pro",
    "team",
    "enterprise",
]);
exports.workspaceMemberRoleEnum = (0, pg_core_1.pgEnum)("workspace_member_role", [
    "owner",
    "admin",
    "editor",
    "viewer",
]);
exports.workspaces = (0, pg_core_1.pgTable)("workspaces", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    slug: (0, pg_core_1.text)("slug").unique().notNull(),
    name: (0, pg_core_1.text)("name").notNull(),
    plan: (0, exports.workspacePlanEnum)("plan").default("free").notNull(),
    clerkOrgId: (0, pg_core_1.text)("clerk_org_id").unique(),
    settings: (0, pg_core_1.jsonb)("settings").$type().default({}).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.workspaceMembers = (0, pg_core_1.pgTable)("workspace_members", {
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => exports.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    userId: (0, pg_core_1.uuid)("user_id").notNull(),
    role: (0, exports.workspaceMemberRoleEnum)("role").default("viewer").notNull(),
    joinedAt: (0, pg_core_1.timestamp)("joined_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [(0, pg_core_1.primaryKey)({ columns: [t.workspaceId, t.userId] })]);
exports.workspaceInvites = (0, pg_core_1.pgTable)("workspace_invites", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => exports.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    email: (0, pg_core_1.text)("email").notNull(),
    role: (0, exports.workspaceMemberRoleEnum)("role").default("editor").notNull(),
    tokenHash: (0, pg_core_1.text)("token_hash").unique().notNull(),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.workspacesRelations = (0, drizzle_orm_1.relations)(exports.workspaces, ({ many }) => ({
    members: many(exports.workspaceMembers),
    invites: many(exports.workspaceInvites),
}));
exports.workspaceMembersRelations = (0, drizzle_orm_1.relations)(exports.workspaceMembers, ({ one }) => ({
    workspace: one(exports.workspaces, {
        fields: [exports.workspaceMembers.workspaceId],
        references: [exports.workspaces.id],
    }),
}));
//# sourceMappingURL=workspaces.js.map