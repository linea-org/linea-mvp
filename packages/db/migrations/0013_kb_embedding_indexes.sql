-- Hand-written: drizzle-kit doesn't emit partial-index WHERE clauses (same as 0001_indexes.sql)
DROP INDEX IF EXISTS "knowledge_entries_embedding_hnsw";
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS knowledge_entries_embedding_768_hnsw
  ON knowledge_entries USING hnsw (embedding_768 vector_cosine_ops)
  WITH (m = 16, ef_construction = 64) WHERE embedding_768 IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS knowledge_entries_embedding_1536_hnsw
  ON knowledge_entries USING hnsw (embedding_1536 vector_cosine_ops)
  WITH (m = 16, ef_construction = 64) WHERE embedding_1536 IS NOT NULL;
--> statement-breakpoint
-- Replaces the non-unique dedup index — the old SELECT-then-INSERT check wasn't atomic
DROP INDEX IF EXISTS "knowledge_entries_content_hash_idx";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS knowledge_entries_kb_content_hash_uidx
  ON knowledge_entries (knowledge_base_id, content_hash)
  WHERE content_hash IS NOT NULL;
