# Memory Module

> Agent long-term memory — LLM-powered fact extraction from free text, pgvector cosine + keyword hybrid search, and per-user memory profiles.

## Base Path
`/v1/workspaces/:workspaceId/memories`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/ingest` | editor+ | Extract atomic facts from free text, embed each, resolve conflicts |
| POST | `/search` | viewer+ | Hybrid search: pgvector cosine + keyword, merged score |
| GET | `/profile` | viewer+ | User memory profile grouped by `factType` |
| POST | `/` | editor+ | Manually store a memory (no LLM extraction) |
| GET | `/` | viewer+ | List memories (filterable by scope, threadId, workflowId) |
| DELETE | `/:id` | editor+ | Delete a memory |

## Key Types

- `IngestMemoryDto` — `{ content: string, scope, threadId?, workflowId?, userId? }`
- `SearchMemoryDto` — `{ query, scope?, limit?, userId?, threadId? }`
- `CreateMemoryDto` — manual insert: `{ content, scope, factType?, metadata? }`
- `ListMemoriesDto` — `{ scope?, threadId?, workflowId?, userId?, limit?, cursor? }`
- `MemoryScope` — `thread | workflow | user | session`
- `MemoryFactType` — `fact | preference | event | profile | system`
- `MemorySource` — `manual | extracted | ingested`

## Business Logic

- **Extraction pipeline** (`POST /ingest`): sends content to LLM (`ExtractionService`) to identify atomic facts; each fact is embedded via `EmbeddingService` and stored with `source='ingested'`
- **Conflict resolution**: before inserting an extracted fact, `ExtractionService` checks for semantically similar existing memories (cosine similarity > threshold) and marks the older one `supersededById`
- **Hybrid search**: `MemoryService.search` runs pgvector cosine similarity + keyword match in parallel and merges scores; same conceptual approach as knowledge hybrid search but applied to the `memories` table
- **Profile view**: `GET /profile` groups non-superseded memories by `factType` for a given `userId` — used by agent nodes to inject user context into prompts

## Dependencies

- `WorkspacesModule` — workspace guard
- `EmbeddingService` — shared embedding utility (within memory module)
- `ExtractionService` — LLM-powered fact extraction (within memory module)

## Changelog

_No recent changes._

## Status

Stable.
