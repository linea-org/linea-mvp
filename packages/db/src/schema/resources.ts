import {
  pgTable,
  timestamp,
  uuid,
  integer,
  boolean,
  numeric,
  bigint,
  pgEnum,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"
import { workspaces } from "./workspaces.js"
import { executions } from "./executions.js"

export const poolTypeEnum = pgEnum("pool_type", [
  "shared",
  "reserved",
  "dedicated",
  "byo",
])

export const resourcePools = pgTable("resource_pools", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  poolType: poolTypeEnum("pool_type").default("shared").notNull(),
  concurrencyBase: integer("concurrency_base").default(1).notNull(),
  concurrencyBurst: integer("concurrency_burst").default(0).notNull(),
  cpuMillicores: integer("cpu_millicores").default(500).notNull(),
  memoryMb: integer("memory_mb").default(256).notNull(),
  timeoutMaxS: integer("timeout_max_s").default(60).notNull(),
  priority: integer("priority").default(0).notNull(),
  burstEnabled: boolean("burst_enabled").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const resourceQuotas = pgTable("resource_quotas", {
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .primaryKey(),
  executionsPerMonth: integer("executions_per_month").default(500).notNull(),
  executionsUsed: integer("executions_used").default(0).notNull(),
  burstMinutesUsed: numeric("burst_minutes_used", { precision: 10, scale: 2 })
    .default("0")
    .notNull(),
  tokensPerMonth: bigint("tokens_per_month", { mode: "number" })
    .default(10_000_000)
    .notNull(),
  tokensUsedMonth: bigint("tokens_used_month", { mode: "number" })
    .default(0)
    .notNull(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const resourceUsage = pgTable("resource_usage", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  executionId: uuid("execution_id").references(() => executions.id, {
    onDelete: "set null",
  }),
  cpuSeconds: numeric("cpu_seconds", { precision: 10, scale: 3 }).notNull(),
  memoryMbSeconds: numeric("memory_mb_seconds", {
    precision: 12,
    scale: 3,
  }).notNull(),
  wallSeconds: numeric("wall_seconds", { precision: 10, scale: 3 }).notNull(),
  burstSeconds: numeric("burst_seconds", { precision: 10, scale: 3 })
    .default("0")
    .notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

export const resourcePoolsRelations = relations(resourcePools, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resourcePools.workspaceId],
    references: [workspaces.id],
  }),
}))

export type ResourcePool = typeof resourcePools.$inferSelect
export type ResourceQuota = typeof resourceQuotas.$inferSelect
export type ResourceUsageRow = typeof resourceUsage.$inferSelect
