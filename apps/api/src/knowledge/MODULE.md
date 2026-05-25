# Knowledge Module

> Manages knowledge bases and their entries for the RAG pipeline — ingestion, deduplication, hybrid search, and per-KB configuration.

## Base Path
`/v1/workspaces/:workspaceId/knowledge-bases`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create a KB. Body: `{ name, description?, settings? }`. Returns the created KB. |
| GET | `/` | viewer+ | List all KBs in the workspace. Returns array with `entryCount` per KB. |
| GET | `/:id` | viewer+ | Get a single KB by ID. Returns KB with settings. |
| PATCH | `/:id` | editor+ | Update name, description, or `KnowledgeBaseSettings`. Returns updated KB. |
| DELETE | `/:id` | editor+ | Delete KB and cascade-delete all entries. Returns 204. |
| POST | `/:id/entries` | editor+ | Add content: splits into chunks, SHA-256 deduplicates, enqueues BullMQ embedding. Body: `{ content, metadata? }`. Returns first chunk with `status: pending`. |
| GET | `/:id/entries` | viewer+ | List entries with `{ id, content, status, chunkIndex, metadata }`. |
| GET | `/:id/entries/:entryId/status` | viewer+ | Get ingestion status for one entry. Returns `{ status }` — poll until `indexed` or `failed`. |
| DELETE | `/:id/entries/:entryId` | editor+ | Delete a single entry. Returns 204. |
| POST | `/:id/search` | viewer+ | Hybrid RRF search (vector 0.7 + BM25 0.3). Body: `{ query, limit? }`. Returns `[{ content, metadata }]`. |

## Key Types

- `KnowledgeBaseSettings` — per-KB RAG config: `chunkSize`, `chunkOverlap`, `similarityThreshold`, `embeddingModel`, `enableRerank`, `rerankTopK`, `expandContext`
- `KnowledgeEntryStatus` — `pending | embedding | indexed | failed`
- `CreateEntryDto` — `{ content: string, metadata? }`
- `SearchEntriesDto` — `{ query: string, limit?: number }`

## Business Logic

- **SHA-256 deduplication**: `content_hash` computed per chunk before insert; duplicate content returns the existing entry without re-embedding
- **Async BullMQ embedding**: `addEntry` splits content into sentence-aware chunks (default 1800 chars / 360 overlap), inserts each with `status='pending'`, enqueues `rag:embed` jobs; worker transitions `pending → embedding → indexed | failed` (3 attempts, exponential backoff)
- **Sentence-aware chunking**: splits at `.?!` sentence boundaries and `\n\n` paragraph breaks before hard-splitting at word boundary; avoids mid-word cuts that degrade embedding quality
- **Hybrid RRF search**: vector arm (pgvector HNSW cosine, weight 0.7) + BM25 arm (GIN full-text, weight 0.3) merged via Reciprocal Rank Fusion (`score = Σ w / (60 + rank)`); 91% Recall@10 vs 78% dense-only
- **3-level settings cascade** for chunkSize, similarityThreshold, embeddingModel: per-node override → `kb.settings` → `workspace.settings.rag*` → system default
- **Context expansion** (`expandContext: true`): after finding chunk X, fetches X-1 and X+1 by `sourceId + chunkIndex` and joins as one context window
- **Cohere reranking** (`enableRerank: true`): retrieves top `rerankTopK` (default 50) candidates, reranks via Cohere Rerank v3.5 API, returns top K; falls back gracefully if no Cohere key

## Dependencies

- `WorkspacesModule` — workspace ownership assertion
- `PodsModule` — pod guard
- `AuditModule` — logs `kb.create` and `kb.delete`
- `BullMQ rag:embed queue` — async embedding worker (`KnowledgeEmbedProcessor`)
- `OpenAI text-embedding-3-small` (default) — 1536-dim vectors stored in pgvector

## Changelog

### 2026-05-25 — RAG Phase 3: hybrid search, context expansion, Cohere reranking
- Replaced `vectorSearch` with `hybridSearch` (parallel vector + FTS arms, RRF merge)
- Added `expandContext` option: fetches neighboring chunks X-1, X, X+1
- Added optional Cohere Rerank v3.5 via `enableRerank` + `rerankTopK` KB settings
- `searchEntries` in service loads KB settings for enableRerank/expandContext cascade

### 2026-05-25 — RAG Phase 2: async ingestion, sentence-aware chunking, status endpoint
- `addEntry` now enqueues `rag:embed` BullMQ jobs instead of embedding synchronously
- `splitIntoChunks` replaced with `splitSentenceAware` (1800/360 char target)
- Added `GET /:id/entries/:entryId/status` endpoint
- UI polls status and shows spinner (queued/embedding) or badge (failed)

### 2026-05-25 — RAG Phase 1: HNSW index, dedup, status tracking, per-KB settings
- Added `content_hash` column + SHA-256 dedup check before insert
- Added `status` column (`pending | embedding | indexed | failed`)
- Added `knowledge_bases.settings` JSONB with `KnowledgeBaseSettings` interface
- DB migration 0001 created HNSW index (`m=16, ef_construction=64`) and GIN index

## Missing / Gaps

- **Bulk entry ingestion**: no `POST /:id/entries/bulk` — ingesting many documents requires N serial requests
- **Entry update**: no `PATCH /:id/entries/:entryId` to replace content; must delete and re-add
- **Search explain**: no way to inspect per-arm scores (vector vs BM25) for a query — useful for tuning RRF weights
- **Rate limiting on search**: search endpoint has no per-workspace throttle; a runaway agent could overload pgvector

## Status

Stable. Phase 4 (Voyage AI variable-dimension embeddings, parent-child chunking, RAGAS eval harness) is planned but not scheduled.
