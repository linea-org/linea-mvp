# Auth Module

> Clerk authentication integration — global JWT guard and webhook handler for user sync.

## Base Path
`/v1/webhooks/clerk` (excluded from global `/v1` prefix and throttling)

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/webhooks/clerk` | Clerk signature | Body: raw Clerk event payload, validated by Svix signature. Handles `user.created` (insert), `user.updated` (email/name/avatar), `user.deleted` (soft-delete). Returns 200. |

## Key Types

- No DTOs — request body is a raw Clerk webhook payload validated by signature

## Business Logic

- `ClerkAuthGuard` is registered as a **global** `APP_GUARD` — all routes require a valid Clerk JWT unless decorated with `@Public()`
- Webhook endpoint verifies Svix signature header before processing
- `user.created` → inserts into `users`; `user.updated` → updates email/name/avatar; `user.deleted` → soft-deletes

## Dependencies

- Used by all other modules via `APP_GUARD` — no imports needed

## Changelog

_No recent changes._

## Missing / Gaps

- **Session listing**: no `GET /me/sessions` to list or revoke active Clerk sessions
- **API key auth path**: `ClerkAuthGuard` handles Clerk JWTs; API key auth (for `public-run`) is handled separately in `PublicRunModule` rather than as a unified guard
- **Audit on auth events**: login/logout events are not written to the audit log

## Status

Stable.
