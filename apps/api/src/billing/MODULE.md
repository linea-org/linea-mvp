# Billing Module

> Subscription and payment management for workspaces.

## Base Path
`/v1/workspaces/:workspaceId/billing`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | admin+ | Get current subscription and usage summary. Returns `{ plan, status, executionsUsed, executionsLimit, nextRenewal }`. |
| POST | `/checkout` | admin+ | Create a Stripe checkout session. Body: `{ priceId, successUrl, cancelUrl }`. Returns `{ checkoutUrl }`. |
| POST | `/portal` | admin+ | Create a Stripe billing portal session. Body: `{ returnUrl }`. Returns `{ portalUrl }`. |

## Dependencies

- `WorkspacesModule` — workspace guard
- Stripe SDK

## Changelog

_No recent changes._

## Missing / Gaps

- **Webhook handler**: no `POST /webhooks/stripe` to handle Stripe events (subscription renewed, payment failed, etc.) — plan status may be stale
- **Invoice listing**: no `GET /invoices` for users to view billing history
- **Usage alerts**: no threshold-based notifications when executions or tokens approach limits

## Status

Stable.
