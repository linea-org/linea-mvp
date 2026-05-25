# Models Module

> Read-only registry of available AI models and their capabilities.

## Base Path
`/v1/models`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | authenticated | List all available models. Returns static registry: `[{ id, provider, name, contextWindow, capabilities[] }]`. |

## Business Logic

- Model list is static — sourced from `apps/api/src/executions/engine/models/registry.ts`
- No DB reads; response is derived from the in-memory registry at startup

## Changelog

_No recent changes._

## Missing / Gaps

- **Workspace model availability**: all models are global — there's no mechanism to restrict which models a workspace can use based on their plan
- **Pricing info**: no `pricing` field (tokens-per-dollar) in the registry — clients can't estimate cost before running
- **Dynamic refresh**: model list is static at startup; adding a new provider requires a redeploy

## Status

Stable.
