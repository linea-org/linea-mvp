"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRelations = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspaces_1 = require("./workspaces");
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    clerkId: (0, pg_core_1.text)("clerk_id").unique().notNull(),
    email: (0, pg_core_1.text)("email").unique().notNull(),
    name: (0, pg_core_1.text)("name"),
    avatarUrl: (0, pg_core_1.text)("avatar_url"),
    onboardedAt: (0, pg_core_1.timestamp)("onboarded_at", { withTimezone: true }),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    workspaceMembers: many(workspaces_1.workspaceMembers),
    invitesSent: many(workspaces_1.workspaceInvites),
}));
//# sourceMappingURL=users.js.map