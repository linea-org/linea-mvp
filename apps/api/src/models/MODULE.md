# Models Module

> Read-only registry of available AI models and their capabilities.

## Base Path
`/v1/models`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | authenticated | List all available models. Returns static registry: `[{ id, provider, name, contextWindow, capabilities[] }]`. |

## Business Logic

- Model list is static — sourced from `apps/api/src/services/ai/model-catalog.ts` (`AI_MODEL_CATALOG`, aggregated from each provider client's `displayModels`)
- No DB reads; response is derived from the in-memory catalog at startup

## Changelog

### 2026-07-04 — BYOK unification

- The workflow execution engine (agent/node executors, supervisor, public-run) now resolves models and API keys through `AIService`/`ConnectionsService` instead of the old `executions/engine/models/{registry,client.factory}.ts`, which has been deleted. `GET /` now reads from `services/ai/model-catalog.ts` instead of the old registry.
- Agent nodes no longer auto-select a default model or fall back to another model/provider on failure — an Agent node with no model configured throws `No model selected` instead of silently picking a tier default.

## Missing / Gaps

- **Workspace model availability**: all models are global — there's no mechanism to restrict which models a workspace can use based on their plan
- **Pricing info**: no `pricing` field (tokens-per-dollar) in the registry — clients can't estimate cost before running
- **Dynamic refresh**: model list is static at startup; adding a new provider requires a redeploy

## Status

Stable.
