"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerConnections = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const workspaces_1 = require("./workspaces");
const pg_core_2 = require("drizzle-orm/pg-core");
const pg_core_3 = require("drizzle-orm/pg-core");
const pg_core_4 = require("drizzle-orm/pg-core");
exports.providerConnections = (0, pg_core_1.pgTable)("provider_connections", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    provider: (0, pg_core_1.text)("provider").notNull(),
    authType: (0, pg_core_1.text)("auth_type").notNull(),
    configEncrypted: (0, pg_core_1.text)("config_encrypted").notNull(),
    encryptionKeyVersion: (0, pg_core_4.integer)("encryption_key_Version")
        .notNull()
        .default(1),
    encryptionIV: (0, pg_core_1.text)("encryption_iv").notNull(),
    encryptionAuthTag: (0, pg_core_1.text)("encryption_auth_tag").notNull(),
    providerUserId: (0, pg_core_1.text)("provider_user_id"),
    providerEmail: (0, pg_core_1.text)("provider_email"),
    expiresAt: (0, pg_core_1.timestamp)("expires_at", { withTimezone: true }),
    enabled: (0, pg_core_2.boolean)("enabled").notNull().default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (t) => [(0, pg_core_3.unique)().on(t.workspaceId, t.provider)]);
//# sourceMappingURL=connections.js.map