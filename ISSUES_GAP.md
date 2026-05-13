# GitHub Issues Gap Analysis

Issues marked "completed" that have partial or missing implementations.

Legend: ✅ Fixed this session | ⚠️ Partial/skipped | 🔲 Not yet done

---

## Issue #2 — SchedulesModule ⚠️

**What's there:** CRUD for schedule records, cron expression storage, `enabled` flag, DB-polling every minute via `@Cron(EVERY_MINUTE)`.

**What's missing:**
- BullMQ repeatable jobs are not wired up. The current DB-polling approach (check `nextRunAt <= now` every minute) is functionally correct but has 1-minute granularity.
- For sub-minute precision, add `addRepeatableJob`/`removeRepeatableJob` lifecycle tied to schedule CRUD.

**Decision:** Current polling is acceptable for v1. Upgrade to BullMQ repeatable jobs when sub-minute scheduling is needed.

---

## Issue #3 — WebhooksModule ✅

**Fixed:**
- `trigger()` now uses HMAC-SHA256 (`sha256=<hex>` via `createHmac` + `timingSafeEqual`).
- Controller now reads raw body and `x-linea-signature` header instead of `x-webhook-secret`.
- Timing-safe comparison prevents timing attacks.

---

## Issue #5 — Clerk Webhooks (sync user/org events) ✅

**Fixed:**
- Added `clerkOrgId text UNIQUE` to `workspaces` schema.
- Added `organization.created` handler → `WorkspacesService.upsertFromClerkOrg`.
- Added `organizationMembership.created` handler → `WorkspacesService.addMemberFromClerk` (upserts with correct role).
- Added `organizationMembership.deleted` handler → `WorkspacesService.removeMemberFromClerk`.
- All handlers are silent-fail safe (log + return if workspace/user not yet synced).

---

## Issue #9 — API Key Authentication ✅ (was already done)

**Already implemented in `users.service.ts`:**
- `findByApiKey` fires `void db.update(lineaApiKeys).set({ lastUsedAt: new Date() })` on every successful auth.
- Key prefix is `lnk_` (correct).
- `ApiKeyGuard` exists at `apps/api/src/auth/guards/api-key.guard.ts`.

**Still missing:**
- `ApiKeyGuard` is not applied to `ExecutionsController` — machine clients can't trigger executions via API key alone.

---

## Issue #15 — Settings Pages (frontend) ✅

**Fixed:**
- Created `SecretsModule` (API): `POST/GET/DELETE /workspaces/:id/secrets`, AES-256-GCM encrypted values, names-only listing.
- Created `/settings/credentials` page — create/list/delete secrets with validation (uppercase name, write-only values).
- Created `/settings/billing` page — shows current plan, per-plan limits table, upgrade CTA, enterprise contact.
- Updated settings layout to add **Secrets** and **Billing** tabs.
- Added `plan?` to workspace context type.

---

## Issue #16 — Executions List & Detail (frontend) ✅

**Fixed:**
- **Re-run button** added — appears on `completed`, `failed`, `cancelled` rows; re-creates execution with same workflowId + input.
- **Cancel button** added — appears on `queued`, `running`, `suspended` rows; calls `DELETE /:id`.
- **Status filter dropdown** added — client-side filter by status.
- **API client 204 fix** — `api.ts` now returns `undefined` for 204/empty responses instead of throwing a parse error.

---

## Issue #17 — Docker Compose ✅

**Fixed:**
- Added `api` service with `DATABASE_URL`, `REDIS_URL`, env_file, and Docker watch sync.
- Added `web` service with `NEXT_PUBLIC_API_URL` and Docker watch sync.
- Both services `depends_on` their prerequisites with health checks.

---

## Issue #18 — CI/CD ✅

**Fixed:**
- Added `test` job with Postgres + Redis service containers and `DATABASE_URL`/`REDIS_URL` env vars.
- Added `build` job (runs after typecheck + lint pass) with `SKIP_ENV_VALIDATION` and placeholder Clerk key.

---

## Issue #20 — Variable Substitution ✅

**Fixed:**
- Added `substituteInValue(value: unknown, state): unknown` to `variable-substitution.ts`.
- Recursively walks objects and arrays, applying string substitution only to string leaves.
- Number, boolean, null values pass through unchanged.

---

## Issue #29 — Agent Memory Tools ✅

**Fixed:**
- Added `memory_store` and `memory_search` to `BUILTIN_TOOLS` in `definitions.ts`.
- `memory_store(key, value)` writes to in-execution `state.memory` immediately and returns `__memoryWrite`.
- `memory_search(query)` searches `state.memory` by key/value substring match.
- `agent.executor.ts` captures `__memoryWrite` → `memoryUpdates`, updates `state.memory` in-process so subsequent `memory_search` calls see new entries.
- `AgentResult` now includes `__memoryUpdates`.
- `langgraph.service.ts` propagates `__memoryUpdates` to `memory` state annotation (reducer merges it in).

---

---

## Architectural items identified (not GitHub issues)

### A — Workspace→Pod hierarchy ✅
Full two-level hierarchy implemented: Workspace → Pod → Workflows/Executions/Schedules/Webhooks.
- `pods` table, `PodsService`, `PodsController`, `PodGuard` all in place.
- Guard chain: `ClerkAuthGuard` (global) → `WorkspaceGuard` → `PodGuard`.
- Frontend: `PodProvider` context, pod switcher in sidebar, `/pods` pages.

### B — `substituteInValue` not called by executors ✅
Applied `substituteInValue(rawNodeData, state)` at the top of `NodeExecutorService.dispatch()` so ALL node types receive deep variable substitution on the entire `nodeData` object before dispatch. Per-field substitution in individual executors now operates on already-substituted values (harmless no-ops).

### C — `ApiKeyGuard` was dead code ✅
`apps/api/src/auth/guards/api-key.guard.ts` was using `X-API-Key` header and was never applied to any controller. The global `ClerkAuthGuard` already handles `lnk_` API keys via `Authorization: Bearer lnk_...`. The dead file was deleted.

### D — Route prefixes missing `pods` rename ✅
`ExecutionsController`, `WebhooksController`, and `SchedulesController` still had `spaces/:spaceId` in their `@Controller` prefix instead of `pods/:podId`. All three were fixed to use `pods/:podId` and all `@Param('spaceId') spaceId` usages updated to `@Param('podId') podId`.

### E — `workspaceMembers.userId` missing FK ⚠️
The `workspace_members` table has a `userId` text column but no foreign key to a `users` table. If a users table is added later, add the FK constraint then.

---

## Summary

| Issue | Status |
|-------|--------|
| #2 SchedulesModule | ⚠️ Polling works, BullMQ repeatable deferred |
| #3 WebhooksModule | ✅ HMAC-SHA256 |
| #5 Clerk org membership | ✅ org + membership sync handlers |
| #9 API key auth | ✅ lastUsedAt was already working; lnk_ handled by global guard |
| #15 Settings pages | ✅ Secrets module + credentials + billing pages |
| #16 Executions UI | ✅ re-run + cancel + filter |
| #17 Docker Compose | ✅ api + web services added |
| #18 CI/CD | ✅ test + build jobs added |
| #20 Variable substitution | ✅ deep object/array walk |
| #29 Agent memory | ✅ tools wired, state propagated |
| Workspace→Pod hierarchy | ✅ full implementation + frontend |
| substituteInValue wiring | ✅ applied at NodeExecutorService.dispatch() level |
| ApiKeyGuard dead code | ✅ deleted; ClerkAuthGuard handles lnk_ keys globally |
| Route prefix spaces→pods | ✅ fixed in executions, webhooks, schedules controllers |
