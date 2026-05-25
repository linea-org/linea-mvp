-- Phase 1: RAG foundation improvements
-- HNSW index, content deduplication, ingestion status, per-KB settings

-- ── 1. HNSW index for fast approximate nearest-neighbor search ──────────────
-- m=16: neighbors per node (8=faster build/less recall; 16=best default; 32=max recall/2x build time)
-- ef_construction=64: build-time candidates (higher=better quality, slower build)
-- At query time: SET hnsw.ef_search = 100 for higher recall (default 40)
-- CONCURRENTLY: safe to run on a live table without locking writes
CREATE INDEX CONCURRENTLY IF NOT EXISTS knowledge_entries_embedding_hnsw
  ON knowledge_entries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- ── 2. Content deduplication ─────────────────────────────────────────────────
-- SHA-256 hash stored per chunk; checked before insert to prevent duplicates
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS content_hash text;

CREATE INDEX IF NOT EXISTS knowledge_entries_content_hash_idx
  ON knowledge_entries (knowledge_base_id, content_hash);

-- ── 3. Ingestion status tracking ─────────────────────────────────────────────
-- Tracks async embedding lifecycle: pending → embedding → indexed | failed
-- Existing rows default to 'indexed' (they were synchronously embedded on insert)
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'indexed';

-- ── 4. Per-knowledge-base settings ───────────────────────────────────────────
-- Stores KnowledgeBaseSettings JSON (chunkSize, chunkOverlap, embeddingModel, etc.)
-- Takes priority over workspace-level settings, which take priority over system defaults
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';
