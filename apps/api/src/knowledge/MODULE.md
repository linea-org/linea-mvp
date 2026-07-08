# Knowledge Module

> Manages knowledge bases and their entries for the RAG pipeline — ingestion, deduplication, hybrid search, and per-KB configuration.

## Base Path
`/v1/workspaces/:workspaceId/knowledge-bases`

## Endpoints

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/` | editor+ | Create a KB. Body: `{ name, description?, settings?, embeddingModel? }`. `embeddingModel` is locked for the KB's lifetime (default: `text-embedding-005`). Returns the created KB. |
| GET | `/` | viewer+ | List all KBs in the workspace. Returns array with `entryCount` per KB. |
| GET | `/:id` | viewer+ | Get a single KB by ID. Returns KB with settings. |
| PATCH | `/:id` | editor+ | Update name, description, or `KnowledgeBaseSettings`. `embeddingModel` cannot be changed after creation — rejected with 400. Returns updated KB. |
| DELETE | `/:id` | editor+ | Delete KB and cascade-delete all entries. Returns 204. |
| POST | `/:id/entries` | editor+ | Add content: splits into chunks, SHA-256 deduplicates, enqueues BullMQ embedding. Body: `{ content, metadata? }`. Returns first chunk with `status: pending`. |
| GET | `/:id/entries` | viewer+ | List entries with `{ id, content, status, chunkIndex, metadata }`. |
| GET | `/:id/entries/:entryId/status` | viewer+ | Get ingestion status for one entry. Returns `{ status, lastError }` — poll until `indexed` or `failed`. |
| POST | `/:id/entries/:entryId/retry` | editor+ | Re-enqueue a `failed` entry for embedding. 400 if the entry isn't currently failed. |
| DELETE | `/:id/entries/:entryId` | editor+ | Delete a single entry. Returns 204. |
| POST | `/:id/search` | viewer+ | Hybrid RRF search (vector 0.7 + BM25 0.3). Body: `{ query, limit? }`. Returns `[{ content, metadata }]`. |

## Key Types

- `KnowledgeBaseSettings` — per-KB RAG config: `chunkSize`, `chunkOverlap`, `similarityThreshold`, `enableRerank`, `rerankTopK`, `expandContext`. `embeddingModel` lives on typed `knowledgeBases.embeddingModel`/`embeddingProvider`/`embeddingDimensions` columns instead
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
- `@linea/ai`'s embedding-model registry (`resolveEmbeddingBucket`) — default `text-embedding-005` (Google, 768-dim); a KB may lock any registered embedding model, routed to one of three bucketed pgvector columns (768/1536/3072) on `knowledge_entries`

## Changelog

### Embedding-model lock + dimension-bucketed columns
- Fixed a live 100%-failure bug: `addEntry`/`searchEntries`/the processor all hardcoded Google `text-embedding-005` (768-dim) writes into a fixed `vector(1536)` column
- `knowledge_entries.embedding` (single 1536-dim column) replaced with `embedding768`/`embedding1536`, one populated per row per its KB's locked bucket. 3072-dim models (`text-embedding-3-large`, `gemini-embedding-001`) are unsupported — pgvector caps hnsw/ivfflat indexes at 2000 dimensions
- `knowledgeBases` gets typed `embeddingModel`/`embeddingProvider`/`embeddingDimensions`, resolved once at `createBase` (or lazily for pre-migration rows) and never mutated — PATCHing `embeddingModel` is rejected (400)
- Reembedding-on-model-change (background reindex) is explicitly deferred, not built — tracked as a follow-up
- `searchEntries` now embeds queries with the KB's own locked model instead of a second hardcoded call — closes a silent cross-model-embedding-comparison bug
- Dedup's non-unique index replaced with a real unique index on `(knowledge_base_id, content_hash)`; added `last_error` column for surfacing failed-entry causes

### Ingest/retrieval integrity fixes
- Retriever node no longer reimplements hybrid search inline — calls `KnowledgeService.hybridSearch` directly, using the target KB's own locked embedding model, closing a cross-model-embedding-comparison bug
- `splitSentenceAware`'s hard-split loop now guarantees forward progress regardless of `chunkOverlap`/`chunkSize`; `addEntry` throws 400 if `chunkOverlap >= chunkSize` instead of risking a hang
- Zero-vector embeddings now throw in the processor, routing to `status: 'failed'` with `lastError` populated, instead of silently marking `indexed` with no vector
- Added `POST .../entries/:entryId/retry` so a `failed` entry can be re-embedded without delete-and-re-add

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
- **Web crawler source**: no way to ingest from a URL or sitemap — users must copy-paste content manually
- **Scheduled re-sync**: no mechanism to re-embed a source on a cron (content can go stale)
- **Metadata filtering**: search has no `filter` parameter to scope retrieval by source, date, or custom tags

## RAG Phase 4 Roadmap

> Deferred until after alpha launch. Implement in order of highest retrieval quality gain.

### 1. Web crawler source
Allow `POST /:id/entries` to accept a `sourceUrl` field. The worker fetches the URL, extracts main content (Mozilla Readability or Trafilatura), splits and embeds it. Optionally follow internal links up to a configurable depth. Enables entire docs sites to be ingested without manual copy-paste.

### 2. Scheduled re-sync
Add a `source` JSONB column to `knowledge_entries` tracking `{ type: 'url', url, fetchedAt }`. A new BullMQ `rag:resync` queue re-fetches stale sources on a per-KB cron (configurable in `KnowledgeBaseSettings`). Hashes new content — if unchanged, skips re-embedding to save tokens.

### 3. Metadata filtering on search
Add an optional `filter` field to `SearchEntriesDto`:
```ts
filter?: { sourceId?: string; after?: string; metadata?: Record<string, string> }
```
Apply as a `WHERE` clause in both the vector and BM25 arms before RRF merge. Enables queries like "find chunks from this document only" or "only content added in the last 30 days".

### 4. Bulk ingestion endpoint
`POST /:id/entries/bulk` accepting `{ entries: Array<{ content, metadata? }> }` up to 100 items. Batches dedup checks and BullMQ enqueues in a single transaction. Reduces API calls from N → 1 for large ingestion jobs.

### 5. RAGAS eval harness
Add `POST /:id/eval` accepting a set of `{ query, expectedAnswer }` pairs. Runs retrieval, feeds chunks to an LLM for answer synthesis, then scores Faithfulness + Answer Relevance via the RAGAS framework. Gives a quantitative RAG quality score per KB — useful for tuning `chunkSize`, RRF weights, and `rerankTopK`.

### 6. Parent-child chunking (stretch)
Index fine-grained child chunks (400 chars) for high-precision retrieval, but return their parent chunk (1800 chars) as context to the LLM. Reduces context noise while maintaining recall. Requires a `parentId` relation on `knowledge_entries`.

## Status

Stable — Phases 1–3 shipped (HNSW index, async ingestion, hybrid RRF search, Cohere reranking). Focusing on alpha launch stability before implementing Phase 4 features above.
