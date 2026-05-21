-- Workspace settings JSONB column
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}';

-- Knowledge entry chunking columns
ALTER TABLE knowledge_entries
  ADD COLUMN IF NOT EXISTS source_id text,
  ADD COLUMN IF NOT EXISTS chunk_index integer,
  ADD COLUMN IF NOT EXISTS total_chunks integer;
