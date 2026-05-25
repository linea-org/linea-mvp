# Billing Module

> Subscription and payment management for workspaces.

## Base Path
`/v1/workspaces/:workspaceId/billing`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/` | admin+ | Get current subscription and usage summary |
| POST | `/checkout` | admin+ | Create a Stripe checkout session |
| POST | `/portal` | admin+ | Create a Stripe billing portal session |

## Dependencies

- `WorkspacesModule` — workspace guard
- Stripe SDK

## Changelog

_No recent changes._

## Status

Stable.
