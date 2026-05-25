-- Token budget tracking columns on resource_quotas
ALTER TABLE resource_quotas
  ADD COLUMN IF NOT EXISTS tokens_per_month bigint NOT NULL DEFAULT 10000000,
  ADD COLUMN IF NOT EXISTS tokens_used_month bigint NOT NULL DEFAULT 0;

-- Full-text search GIN index on knowledge_entries.content
-- Used as a fast fallback when no vector embedding is available
CREATE INDEX IF NOT EXISTS knowledge_entries_content_fts
  ON knowledge_entries USING GIN (to_tsvector('english', content));
