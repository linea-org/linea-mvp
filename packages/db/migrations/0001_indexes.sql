-- Full-text search GIN index on knowledge_entries.content
-- Used by the BM25 arm of the hybrid RRF retrieval pipeline
CREATE INDEX IF NOT EXISTS knowledge_entries_content_fts
  ON knowledge_entries USING GIN (to_tsvector('english', content));
--> statement-breakpoint
-- content_hash lookup index — fast dedup check before insert
CREATE INDEX IF NOT EXISTS knowledge_entries_content_hash_idx
  ON knowledge_entries (knowledge_base_id, content_hash);
--> statement-breakpoint
-- HNSW index for fast approximate nearest-neighbor vector search
-- m=16: sweet spot (8=faster build, 32=max recall/2x build time)
-- ef_construction=64: build-time candidates (higher=better quality, slower)
-- At query time: SET hnsw.ef_search = 100 for better recall (default 40)
-- Note: cannot use CONCURRENTLY inside a transaction
CREATE INDEX IF NOT EXISTS knowledge_entries_embedding_hnsw
  ON knowledge_entries USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
