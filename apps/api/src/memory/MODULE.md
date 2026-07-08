# Memory Module

> Agent long-term memory — LLM-powered fact extraction from free text, pgvector cosine + keyword hybrid search, and per-user memory profiles.

## Base Path
`/v1/workspaces/:workspaceId/memories`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/ingest` | editor+ | LLM-extract atomic facts from free text, embed, and deduplicate. Body: `{ content, scope, threadId?, workflowId? }`. `userId` is always the authenticated caller, never a body field. Returns `{ inserted: number, superseded: number }`. |
| POST | `/search` | viewer+ | Hybrid search (pgvector cosine + keyword), scoped to the caller's own memories. Body: `{ query, scope?, limit?, threadId? }`. Returns `[{ content, factType, score, metadata }]`. |
| GET | `/profile` | viewer+ | Caller's own memory profile grouped by `factType`. Returns memories grouped by type; excludes superseded entries. |
| POST | `/` | editor+ | Manually store a memory without LLM extraction. Body: `{ content, scope, factType?, metadata? }`. Returns created memory. |
| GET | `/` | viewer+ | List the caller's own memories. Query: `{ scope?, threadId?, workflowId? }`. Returns paginated array. |
| DELETE | `/:id` | editor+ | Delete a memory. Returns 204. |

`userId` is always derived from `@CurrentUser()`, never accepted as a client-supplied filter/query param.

## Key Types

- `IngestMemoryDto` — `{ content: string, scope, threadId?, workflowId? }`
- `SearchMemoryDto` — `{ query, scope?, limit?, threadId? }`
- `CreateMemoryDto` — manual insert: `{ content, scope, factType?, metadata? }`
- `ListMemoriesDto` — `{ scope?, threadId?, workflowId? }`
- `MemoryScope` — `thread | workflow | user | session`
- `MemoryFactType` — `fact | preference | event | profile | system`
- `MemorySource` — `manual | extracted | ingested`

## Business Logic

- **Extraction pipeline** (`POST /ingest`): sends content to LLM (`ExtractionService`) to identify atomic facts; each fact is embedded via `EmbeddingService` and stored with `source='ingested'`
- **Conflict resolution**: before inserting an extracted fact, `ExtractionService` checks for semantically similar existing memories (cosine similarity > threshold) and marks the older one `supersededById`
- **Hybrid search**: `MemoryService.search` runs pgvector cosine similarity + keyword match in parallel and merges scores; same conceptual approach as knowledge hybrid search but applied to the `memories` table
- **Profile view**: `GET /profile` groups the caller's own non-superseded memories by `factType`

## Dependencies

- `WorkspacesModule` — workspace guard
- `EmbeddingService` — shared embedding utility (within memory module)
- `ExtractionService` — LLM-powered fact extraction (within memory module)

## Changelog

- `search`/`getProfile`/`findAll` no longer accept a client-supplied `userId` — always bound to the authenticated caller. Added `@RequireRole('viewer')` for consistency with the rest of the controller.

## Missing / Gaps

- **Bulk delete**: no `DELETE /` to wipe all memories for a scope/user — requires iterating individual deletes
- **Manual supersede**: no endpoint to manually mark a memory as superseded by another (only conflict resolution does this automatically)
- **Search explain**: no way to inspect the per-arm scores (cosine vs keyword) for a query result

## Status

Stable.
