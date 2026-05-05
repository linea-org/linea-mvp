# Linea Memory System — SuperMemory-Inspired Plan

References (for future alignment):

- <https://supermemory.ai/llms.txt>
- <https://supermemory.ai/research/>

Goal: approximate **40–50%** of what Sumit (SuperMemory) describes — no expectation of full parity.

---

## SuperMemory’s five layers (summary)

1. **User profiles** — behavioral analysis, structured user understanding  
2. **Memory graph** — relational versioning (updates supersede, extends refine, derives infer)  
3. **Retrieval** — hybrid vector + keyword, sub-300ms, context reranking  
4. **Extractors** — LLM decomposes conversations into atomic facts  
5. **Connectors** — Claude Code, LangChain, web pages, audio  

---

## What Linea already has

- Memories table with **content + vector(1536) + scope**, basic CRUD, text search  
- Gaps: **no embeddings being generated**, no extraction, no conflict resolution, no hybrid search  

---

## Target scope (40–50%)

**Include:** layers 1–4 in a simplified form.  
**Exclude:** full connectors, audio, dedicated reranker, full graph DB.

| SuperMemory layer   | Our coverage | Notes |
|---------------------|--------------|--------|
| Extractors          | Full         | LLM-powered atomic fact extraction from raw text/conversations |
| Retrieval           | Good         | pgvector cosine similarity + keyword, merged scoring |
| Relational versioning | Partial    | `supersededBy` FK — new facts replace old contradictions |
| User profiles       | Basic        | Aggregate `scope=user` memories into structured profile |
| Temporal grounding  | Basic        | `eventDate` column separate from `createdAt` |
| Memory graph        | Skip         | Full graph traversal (Neo4j, etc.) — overkill for v1 |
| Connectors          | Skip         | No web crawl, audio, or external integrations for this plan |

---

## Part 1 — DB schema (`packages/db/src/schema/memory.ts`)

### Extend `memories` — add columns

- **`source`**: `pgEnum('memory_source', ['manual', 'extracted', 'ingested'])` — default `'manual'`, not null  
- **`factType`**: `pgEnum('memory_fact_type', ['fact', 'preference', 'event', 'profile', 'system'])` — nullable  
- **`eventDate`**: `timestamp` nullable — when the event occurred (≠ `createdAt`)  
- **`supersededById`**: `uuid` FK → `memories.id`, `SET NULL` on delete, nullable — old memory points to replacement  
- **`confidence`**: `real` default `1.0` — extraction confidence 0–1  
- **`metadata`**: `jsonb` default `{}` — structured payload from extractor  

### New table: `memory_sessions` (ingestion batches)

```text
memory_sessions:
  id, workspaceId FK, userId FK nullable,
  threadId text nullable,
  rawContent text,
  memoriesExtracted integer,
  processedAt timestamp,
  createdAt timestamp,
```

After schema change: run **`db:push`** (or equivalent migration flow).

---

## Part 2 — API endpoints

### `POST /workspaces/:id/memories/ingest` (core)

Accepts raw text (conversation excerpt, document chunk, note).

**Pipeline:**

1. Call LLM (**Claude Haiku** — cheap) to extract **3–10** atomic facts as JSON array  
2. For each fact: generate embedding (**OpenAI `text-embedding-3-small`**)  
3. For each fact: query existing memories with pgvector cosine similarity — **top-3** nearest  
4. If similarity **> 0.92** **and** fact **contradicts** existing → set old `supersededById = newId`, insert new  
5. If similarity **> 0.92** **and** fact **extends** → insert new, link via `metadata`  
6. Else → insert fresh  
7. Log session in `memory_sessions`  

**Response:** `{ memoriesCreated, memoriesUpdated, sessionId }`

### `POST /workspaces/:id/memories/search` (hybrid retrieval)

Body: `{ query: string, scope?: string, limit?: number, userId?: string }`

**Pipeline:**

1. Embed query with `text-embedding-3-small`  
2. pgvector cosine similarity → top-20 candidates  
3. Keyword (`ilike`) search → top-20 candidates  
4. Merge: dedupe by id, **`score = 0.7 * vectorScore + 0.3 * keywordScore`**  
5. Filter out superseded rows (`supersededById IS NOT NULL` on the *superseded* record — i.e. only return “current” memories)  
6. Return top-K by merged score  

### `GET /workspaces/:id/memories/profile` (profile layer)

Aggregate all `scope=user` memories for a user; group by `factType`:

```json
{
  "facts": [],
  "preferences": [],
  "events": [],
  "profile": []
}
```

---

## Part 3 — Extraction prompt (Claude Haiku)

Extract atomic facts from the following text. Each fact must be:

- A single, self-contained statement  
- Specific (no unresolved pronouns like “they” / “it”)  
- Categorized: `fact` | `preference` | `event` | `profile` | `system`  
- Given **confidence** `0.0–1.0`  
- Given **`eventDate`** if about something that happened at a specific time  

**Output:** JSON array: `[{ content, factType, confidence, eventDate? }]`

**Text:** `{input}`

---

## Part 4 — Implementation order

1. **DB schema** — extend `memories`, add `memory_sessions`, migrate/push  
2. **`EmbeddingService`** — `apps/api/src/memory/embedding.service.ts` wrapping `text-embedding-3-small`; inject into memory layer  
3. **`ExtractionService`** — `apps/api/src/memory/extraction.service.ts` — Haiku + prompt above  
4. **`MemoryService` updates:**  
   - `ingest(workspaceId, userId, content, opts)` — full pipeline  
   - `search(workspaceId, query, opts)` — hybrid + pgvector  
   - `getProfile(workspaceId, userId)` — grouped profile  
   - `create()` — generate embedding before insert  
5. **`MemoryController`** — wire new routes  
6. **Frontend** — Knowledge page memory tab; optional `/memory` page: ingest box, search, profile  

---

## Part 5 — Dependencies

| Package / capability | Purpose |
|----------------------|---------|
| `openai` | `text-embedding-3-small` (may already exist for agent executor) |
| pgvector + Drizzle | Cosine distance; e.g. `sql` template: `` sql`${memories.embedding} <=> ${embeddingVector}` `` as distance |
| `@anthropic-ai/sdk` | Haiku extraction (may already exist in engine) |

---

## What this delivers

- Ingest text → structured atomic memories  
- **Conflict-aware** updates (e.g. “moved to London” supersedes “lives in Paris”)  
- **Hybrid retrieval** vs pure vector or pure keyword  
- **User profile** rollup from memory history  
- **Session audit** per ingestion  
- ~**45%** of SuperMemory — missing: full memory graph, audio/web connectors, dedicated reranker, deep behavioral inference  

---

## Open decision (before implementation)

**Embeddings provider:** Prefer OpenAI keys in config if available; otherwise consider Anthropic embeddings or a **provider-agnostic** embedding interface so keys can swap without rewriting retrieval.
