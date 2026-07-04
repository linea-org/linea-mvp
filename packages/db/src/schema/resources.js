"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resourcePoolsRelations = exports.resourceUsage = exports.resourceQuotas = exports.resourcePools = exports.poolTypeEnum = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
const workspaces_1 = require("./workspaces");
const executions_1 = require("./executions");
exports.poolTypeEnum = (0, pg_core_1.pgEnum)("pool_type", [
    "shared",
    "reserved",
    "dedicated",
    "byo",
]);
exports.resourcePools = (0, pg_core_1.pgTable)("resource_pools", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull()
        .unique(),
    poolType: (0, exports.poolTypeEnum)("pool_type").default("shared").notNull(),
    concurrencyBase: (0, pg_core_1.integer)("concurrency_base").default(1).notNull(),
    concurrencyBurst: (0, pg_core_1.integer)("concurrency_burst").default(0).notNull(),
    cpuMillicores: (0, pg_core_1.integer)("cpu_millicores").default(500).notNull(),
    memoryMb: (0, pg_core_1.integer)("memory_mb").default(256).notNull(),
    timeoutMaxS: (0, pg_core_1.integer)("timeout_max_s").default(60).notNull(),
    priority: (0, pg_core_1.integer)("priority").default(0).notNull(),
    burstEnabled: (0, pg_core_1.boolean)("burst_enabled").default(false).notNull(),
    createdAt: (0, pg_core_1.timestamp)("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.resourceQuotas = (0, pg_core_1.pgTable)("resource_quotas", {
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .primaryKey(),
    executionsPerMonth: (0, pg_core_1.integer)("executions_per_month").default(500).notNull(),
    executionsUsed: (0, pg_core_1.integer)("executions_used").default(0).notNull(),
    burstMinutesUsed: (0, pg_core_1.numeric)("burst_minutes_used", { precision: 10, scale: 2 })
        .default("0")
        .notNull(),
    tokensPerMonth: (0, pg_core_1.bigint)("tokens_per_month", { mode: "number" })
        .default(10_000_000)
        .notNull(),
    tokensUsedMonth: (0, pg_core_1.bigint)("tokens_used_month", { mode: "number" })
        .default(0)
        .notNull(),
    resetAt: (0, pg_core_1.timestamp)("reset_at", { withTimezone: true }).notNull(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.resourceUsage = (0, pg_core_1.pgTable)("resource_usage", {
    id: (0, pg_core_1.uuid)("id").primaryKey().defaultRandom(),
    workspaceId: (0, pg_core_1.uuid)("workspace_id")
        .references(() => workspaces_1.workspaces.id, { onDelete: "cascade" })
        .notNull(),
    executionId: (0, pg_core_1.uuid)("execution_id").references(() => executions_1.executions.id, {
        onDelete: "set null",
    }),
    cpuSeconds: (0, pg_core_1.numeric)("cpu_seconds", { precision: 10, scale: 3 }).notNull(),
    memoryMbSeconds: (0, pg_core_1.numeric)("memory_mb_seconds", {
        precision: 12,
        scale: 3,
    }).notNull(),
    wallSeconds: (0, pg_core_1.numeric)("wall_seconds", { precision: 10, scale: 3 }).notNull(),
    burstSeconds: (0, pg_core_1.numeric)("burst_seconds", { precision: 10, scale: 3 })
        .default("0")
        .notNull(),
    recordedAt: (0, pg_core_1.timestamp)("recorded_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
});
exports.resourcePoolsRelations = (0, drizzle_orm_1.relations)(exports.resourcePools, ({ one }) => ({
    workspace: one(workspaces_1.workspaces, {
        fields: [exports.resourcePools.workspaceId],
        references: [workspaces_1.workspaces.id],
    }),
}));
//# sourceMappingURL=resources.js.map