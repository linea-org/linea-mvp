# RAG Architecture — Linea Knowledge System

Living reference for the Retrieval-Augmented Generation (RAG) pipeline.
Updated as each phase ships. See also: `C:\Users\rohit\.claude\plans\dapper-popping-prism.md`.

---

## Overview & Motivation

The Linea knowledge system lets agents retrieve relevant content from user-managed knowledge bases before generating responses. The quality of that retrieval directly impacts answer accuracy and hallucination rates.

**Benchmarks that drive this roadmap (2025):**

| Technique | Recall@10 | Notes |
|-----------|-----------|-------|
| Dense-only (pgvector, current) | 78% | Baseline |
| BM25 keyword search | 65% | Good for exact terms, misses semantics |
| **Hybrid BM25 + Vector (RRF)** | **91%** | +17pp, only +6ms latency |
| + Reranking (Cohere v3.5) | ~95%+ | 15–30% RAGAS score improvement |

**RAGAS production targets** (measure after Phase 3):
- Faithfulness > 0.9
- Answer Relevancy > 0.85
- Context Precision > 0.8

---

## Architecture Diagrams

### Ingestion Pipeline (Phase 1 — synchronous)

```
POST /entries
      │
      ▼
 assertBaseOwnership()
      │
      ▼
 Load WS + KB settings (parallel)
      │
      ▼
 SHA-256 dedup check ──► exists? → return existing entry
      │
      ▼
 splitIntoChunks(content, chunkSize, chunkOverlap)
      │
      ▼
 For each chunk:
   embed(chunk) → OpenAI text-embedding-3-small
   INSERT knowledge_entries (content, embedding, contentHash, status='indexed')
      │
      ▼
 UPDATE knowledge_bases.updatedAt
      │
      ▼
 return first entry
```

### Retrieval Pipeline (Phase 1 — vector + FTS fallback)

```
GET /search?query=...
      │
      ▼
 embed(query) → queryEmbedding
      │
      ▼
 vectorSearch(kbId, queryEmbedding, query, limit, similarityThreshold)
      │
      ├─► Vector path (pgvector HNSW):
      │     SELECT ... WHERE embedding <=> query::vector < distanceThreshold
      │     ORDER BY distance LIMIT K
      │
      └─► FTS fallback (if vector returns 0 results or embedding unavailable):
            SELECT ... WHERE to_tsvector('english', content) @@ plainto_tsquery(query)
            ORDER BY ts_rank(...) DESC LIMIT K
```

---

## Configuration Reference

Settings follow a 3-level cascade — the first non-null value wins:

```
1. nodeData.[setting]                ← per-node override (retriever node panel in UI)
2. knowledgeBases.settings.[setting] ← per-KB override  (NEW in Phase 1)
3. workspaces.settings.rag[Setting]  ← workspace default
4. system hardcoded default          ← fallback of last resort
```

| Setting | KB field | WS field | System default | Notes |
|---------|----------|----------|----------------|-------|
| Chunk size | `chunkSize` | `ragChunkSize` | `1000` chars | Phase 2 updates default to `1800` (~512 tokens) |
| Chunk overlap | `chunkOverlap` | `ragChunkOverlap` | `200` chars | Phase 2 updates to `360` (20%) |
| Similarity threshold | `similarityThreshold` | `ragSimilarityThreshold` | `0.75` | Minimum cosine similarity (0–1). Converted to distance: `1 - threshold` |
| Embedding model | `embeddingModel` | — | `text-embedding-3-small` | Must be 1536d OpenAI model |
| Enable rerank | `enableRerank` | — | `false` | Phase 3: Cohere Rerank v3.5 |
| Rerank top-K | `rerankTopK` | — | `50` | Phase 3: candidates sent to reranker |
| Expand context | `expandContext` | — | `false` | Phase 3: fetch neighboring chunks |

---

## Migration Log

### `0001_api_key_expiry_revocation.sql`
Added `expires_at` and `revoked_at` columns to `api_keys`.

### `0002_eval_runs.sql`
`eval_runs` table for workflow evaluation tracking.

### `0003_token_budget_and_gin_index.sql`
GIN index on `knowledge_entries.content` for full-text search.
Token budget columns on executions.

### `0004_workspace_settings_and_chunks.sql`
`workspaces.settings` JSONB column.
`knowledge_entries`: `source_id`, `chunk_index`, `total_chunks` columns for chunked document tracking.

### `0005_rag_phase1.sql` ← current
- **HNSW index** on `knowledge_entries.embedding` — fast approximate nearest-neighbor
- **`content_hash`** column — SHA-256 per chunk, enables deduplication
- **`status`** column — ingestion lifecycle (`pending | embedding | indexed | failed`)
- **`knowledge_bases.settings`** JSONB — per-KB RAG settings

---

## HNSW Tuning Guide

pgvector HNSW builds a graph for approximate nearest-neighbor search. Defaults in migration 0005:

```sql
CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
```

| Parameter | Value | Effect |
|-----------|-------|--------|
| `m` | 16 | Connections per node. 8 = faster build, less recall. 32 = max recall, 2× build time. **16 is the sweet spot.** |
| `ef_construction` | 64 | Candidates during build. Higher = better quality index, slower build. |
| `hnsw.ef_search` | 40 (default) | Candidates during query. **Set to 100 for higher recall at query time.** |

**To verify the index is being used:**
```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT content FROM knowledge_entries
WHERE knowledge_base_id = '<id>'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```
Expected: `Index Scan using knowledge_entries_embedding_hnsw` (not `Seq Scan`).

**To raise ef_search at query time:**
```sql
SET hnsw.ef_search = 100;
-- then run your vector query
```
Can be set per-session in the service if high recall is needed.

---

## Embedding Model Compatibility Matrix

The pgvector schema stores **1536-dimensional** vectors. Models that output different dimensions fall back to keyword (FTS) search — no error, just reduced retrieval quality.

| Model | Provider | Dimensions | MTEB avg | pgvector compatible |
|-------|----------|-----------|----------|---------------------|
| `text-embedding-3-small` | OpenAI | 1536 | ~62% | ✅ native (default) |
| `text-embedding-3-large` | OpenAI | 1536 | 64.6% | ✅ native |
| `text-embedding-ada-002` | OpenAI | 1536 | ~61% | ✅ native |
| `voyage-3` | Voyage AI | 1024 | ~67%+ | ⚠️ needs schema migration (Phase 4) |
| `text-embedding-004` | Google | 768 | ~64% | ❌ falls back to FTS |
| `nomic-embed-text` | Ollama | 768 | ~62% | ❌ falls back to FTS |
| `mxbai-embed-large` | Ollama | 1024 | ~64% | ❌ falls back to FTS |

> **Note**: Voyage AI outperforms OpenAI by ~9.74% on MTEB benchmarks. Phase 4 will add a variable-dimension pgvector column to support it natively.

---

## Cost Reference

| Mode | Cost / query | When to use |
|------|-------------|-------------|
| Naive (dense-only) | ~$0.001 | Dev / low-traffic |
| Hybrid + Rerank (Cohere) | ~$0.005 | Production default |
| Agentic (multi-step retrieval) | $0.02–0.10 | Complex Q&A workflows |

Cohere Rerank v3.5: $2 / 1,000 searches.
OpenAI text-embedding-3-small: $0.02 / 1M tokens.

---

## Roadmap

| Phase | Branch | Status | Key deliverables |
|-------|--------|--------|-----------------|
| Phase 1 — Foundation | `feat/rag-phase-1` | ✅ shipped | HNSW index, SHA-256 dedup, status column, per-KB settings |
| Phase 2 — Smarter ingestion | `feat/rag-phase-2` | 🔜 next | Sentence-aware chunking (512-token), async BullMQ queue, status endpoint + UI badge |
| Phase 3 — Better retrieval | `feat/rag-phase-3` | 🔜 planned | Hybrid RRF search (BM25 0.3 + vector 0.7), context expansion, optional Cohere reranking |
| Phase 4 — Advanced | — | 💡 future | Semantic caching, parent-child chunking, Voyage AI, RAGAS eval harness |
