# Memory Module

> Agent long-term memory — LLM-powered fact extraction from free text, pgvector cosine + keyword hybrid search, and per-user memory profiles.

## Base Path
`/v1/workspaces/:workspaceId/memories`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/ingest` | editor+ | LLM-extract atomic facts from free text, embed, and deduplicate. Body: `{ content, scope, threadId?, workflowId?, userId? }`. Returns `{ inserted: number, superseded: number }`. |
| POST | `/search` | viewer+ | Hybrid search (pgvector cosine + keyword). Body: `{ query, scope?, limit?, userId?, threadId? }`. Returns `[{ content, factType, score, metadata }]`. |
| GET | `/profile` | viewer+ | User memory profile grouped by `factType`. Query: `{ userId }`. Returns memories grouped by type; excludes superseded entries. |
| POST | `/` | editor+ | Manually store a memory without LLM extraction. Body: `{ content, scope, factType?, metadata? }`. Returns created memory. |
| GET | `/` | viewer+ | List memories. Query: `{ scope?, threadId?, workflowId?, userId?, limit?, cursor? }`. Returns paginated array. |
| DELETE | `/:id` | editor+ | Delete a memory. Returns 204. |

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

## Missing / Gaps

- **Bulk delete**: no `DELETE /` to wipe all memories for a scope/user — requires iterating individual deletes
- **Manual supersede**: no endpoint to manually mark a memory as superseded by another (only conflict resolution does this automatically)
- **Search explain**: no way to inspect the per-arm scores (cosine vs keyword) for a query result

## Status

Stable.
