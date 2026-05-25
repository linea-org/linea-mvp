# Models Module

> Read-only registry of available AI models and their capabilities.

## Base Path
`/v1/models`

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | authenticated | List all available models with provider, capabilities, and context window |

## Business Logic

- Model list is static — sourced from `apps/api/src/executions/engine/models/registry.ts`
- No DB reads; response is derived from the in-memory registry at startup

## Changelog

_No recent changes._

## Status

Stable.
