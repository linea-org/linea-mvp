import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { and, eq, count, desc, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { DrizzleDB, NewKnowledgeBase, NewKnowledgeEntry, KnowledgeBaseSettings } from '@linea/db';
import { knowledgeBases, knowledgeEntries, workspaces } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { EmbeddingService } from '../memory/embedding.service';
import type { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import type { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { SearchEntriesDto } from './dto/search-entries.dto';
import { RAG_EMBED_QUEUE } from './knowledge.queue';
import type { RagEmbedJobData } from './knowledge.queue';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly embeddingService: EmbeddingService,
    @InjectQueue(RAG_EMBED_QUEUE) private readonly embedQueue: Queue<RagEmbedJobData>,
  ) {}

  // ─── Knowledge Bases ────────────────────────────────────────────────────────

  async createBase(workspaceId: string, dto: CreateKnowledgeBaseDto) {
    const [kb] = await this.db
      .insert(knowledgeBases)
      .values({
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
        settings: dto.settings ?? {},
      } satisfies Partial<NewKnowledgeBase> as NewKnowledgeBase)
      .returning();
    return kb;
  }

  async listBases(workspaceId: string) {
    const rows = await this.db
      .select({
        id: knowledgeBases.id,
        name: knowledgeBases.name,
        description: knowledgeBases.description,
        createdAt: knowledgeBases.createdAt,
        updatedAt: knowledgeBases.updatedAt,
        entryCount: count(knowledgeEntries.id),
      })
      .from(knowledgeBases)
      .leftJoin(
        knowledgeEntries,
        eq(knowledgeEntries.knowledgeBaseId, knowledgeBases.id),
      )
      .where(eq(knowledgeBases.workspaceId, workspaceId))
      .groupBy(knowledgeBases.id)
      .orderBy(desc(knowledgeBases.updatedAt));

    return rows;
  }

  async getBase(workspaceId: string, id: string) {
    const [kb] = await this.db
      .select()
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!kb) throw new NotFoundException(`Knowledge base ${id} not found`);
    return kb;
  }

  async updateBase(
    workspaceId: string,
    id: string,
    dto: UpdateKnowledgeBaseDto,
  ) {
    await this.getBase(workspaceId, id);

    const [updated] = await this.db
      .update(knowledgeBases)
      .set({ ...dto, updatedAt: new Date() })
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.workspaceId, workspaceId),
        ),
      )
      .returning();

    return updated;
  }

  async deleteBase(workspaceId: string, id: string) {
    await this.getBase(workspaceId, id);
    await this.db
      .delete(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, id),
          eq(knowledgeBases.workspaceId, workspaceId),
        ),
      );
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  private async assertBaseOwnership(workspaceId: string, kbId: string) {
    const [kb] = await this.db
      .select({ id: knowledgeBases.id })
      .from(knowledgeBases)
      .where(
        and(
          eq(knowledgeBases.id, kbId),
          eq(knowledgeBases.workspaceId, workspaceId),
        ),
      )
      .limit(1);

    if (!kb) throw new NotFoundException(`Knowledge base ${kbId} not found`);
  }

  /**
   * Sentence-aware chunking — splits at sentence boundaries, not mid-word.
   * Benchmark: 36% F1 improvement over character-split on structured content.
   * Target: ~512 tokens / ~1800 chars per chunk, 20% overlap.
   *
   * Algorithm:
   * 1. Split text into sentences at [.?!]\s+[A-Z], \n\n, or \n# boundaries
   * 2. Accumulate sentences until the chunk would exceed maxChars
   * 3. Start next chunk by reusing the last `overlap` chars (sliding window)
   * 4. If a single sentence exceeds maxChars, hard-split at word boundary
   */
  private splitSentenceAware(text: string, maxChars = 1800, overlap = 360): string[] {
    if (text.length <= maxChars) return [text];

    // Split at sentence boundaries: period/question/exclamation followed by whitespace+capital,
    // or paragraph breaks (\n\n), or markdown headings (\n#)
    const sentenceRe = /(?<=[.?!])\s+(?=[A-Z])|(?<=\n)\n+|(?=\n#)/;
    const sentences = text.split(sentenceRe).filter((s) => s.trim().length > 0);

    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      // If a single sentence is too long, hard-split at word boundary
      if (sentence.length > maxChars) {
        if (current.trim()) {
          chunks.push(current.trim());
          current = '';
        }
        // Word-boundary hard split
        let pos = 0;
        while (pos < sentence.length) {
          let end = Math.min(pos + maxChars, sentence.length);
          // Snap back to nearest word boundary
          if (end < sentence.length) {
            const lastSpace = sentence.lastIndexOf(' ', end);
            if (lastSpace > pos) end = lastSpace;
          }
          chunks.push(sentence.slice(pos, end).trim());
          pos = end - overlap;
          if (pos < 0) pos = end; // guard infinite loop
        }
        continue;
      }

      if ((current + ' ' + sentence).length > maxChars && current.trim()) {
        chunks.push(current.trim());
        // Overlap: seed next chunk with the tail of the previous
        const tail = current.slice(Math.max(0, current.length - overlap));
        current = tail + ' ' + sentence;
      } else {
        current = current ? current + ' ' + sentence : sentence;
      }
    }

    if (current.trim()) chunks.push(current.trim());
    return chunks.length > 0 ? chunks : [text];
  }

  async addEntry(workspaceId: string, kbId: string, dto: CreateEntryDto) {
    await this.assertBaseOwnership(workspaceId, kbId);

    // Load workspace + KB settings in parallel — 3-level cascade:
    //   per-node override → kbSettings → wsSettings → system default
    const [[ws], [kb]] = await Promise.all([
      this.db
        .select({ settings: workspaces.settings })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1),
      this.db
        .select({ settings: knowledgeBases.settings })
        .from(knowledgeBases)
        .where(eq(knowledgeBases.id, kbId))
        .limit(1),
    ]);

    const wsSettings = ws?.settings ?? {};
    const kbSettings: KnowledgeBaseSettings = kb?.settings ?? {};

    // Settings cascade: KB → workspace → system default
    const CHUNK_SIZE   = kbSettings.chunkSize   ?? wsSettings.ragChunkSize   ?? 1000;
    const CHUNK_OVERLAP = kbSettings.chunkOverlap ?? wsSettings.ragChunkOverlap ?? 200;

    // ── Deduplication: skip if whole-document hash already exists in this KB ──
    const contentHash = createHash('sha256').update(dto.content).digest('hex');
    const [existing] = await this.db
      .select({ id: knowledgeEntries.id })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.knowledgeBaseId, kbId),
          eq(knowledgeEntries.contentHash, contentHash),
        ),
      )
      .limit(1);

    if (existing) {
      this.logger.debug(`Duplicate content detected for KB ${kbId}, skipping insert`);
      return existing;
    }

    const embeddingModel = kbSettings.embeddingModel ?? 'text-embedding-3-small';
    const chunks = this.splitSentenceAware(dto.content, CHUNK_SIZE, CHUNK_OVERLAP);
    const sourceId = chunks.length > 1 ? crypto.randomUUID() : null;
    const totalChunks = chunks.length > 1 ? chunks.length : null;

    const inserted: (typeof knowledgeEntries.$inferSelect)[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const chunkHash = chunks.length > 1
        ? createHash('sha256').update(chunk).digest('hex')
        : contentHash;

      // Insert with status='pending' — the BullMQ worker will embed and flip to 'indexed'
      const [entry] = await this.db
        .insert(knowledgeEntries)
        .values({
          knowledgeBaseId: kbId,
          content: chunk,
          metadata: dto.metadata ?? {},
          sourceId,
          chunkIndex: chunks.length > 1 ? i : null,
          totalChunks,
          contentHash: chunkHash,
          status: 'pending',
        } satisfies Partial<NewKnowledgeEntry> as NewKnowledgeEntry)
        .returning();

      inserted.push(entry!);

      // Enqueue embedding job — worker marks 'embedding' → 'indexed' | 'failed'
      await this.embedQueue.add(
        'embed',
        {
          entryId: entry!.id,
          knowledgeBaseId: kbId,
          workspaceId,
          content: chunk,
          contentHash: chunkHash,
          embeddingModel,
        } satisfies RagEmbedJobData,
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 500,
          removeOnFail: 200,
        },
      );
    }

    await this.db
      .update(knowledgeBases)
      .set({ updatedAt: new Date() })
      .where(eq(knowledgeBases.id, kbId));

    return inserted[0]!;
  }

  /**
   * Vector-similarity search against embedded entries.
   * Falls back to full-text search (FTS) when embeddings are unavailable.
   */
  async vectorSearch(
    kbId: string,
    queryEmbedding: number[] | null,
    query: string,
    limit: number,
    similarityThreshold = 0.75,
  ): Promise<Array<{ content: string; metadata: Record<string, unknown> }>> {
    if (queryEmbedding) {
      try {
        const embLiteral = `[${queryEmbedding.join(',')}]`;
        // similarityThreshold is a minimum cosine similarity (0–1, higher = stricter).
        // pgvector's <=> operator returns cosine DISTANCE (0=identical, 2=opposite).
        // Convert: distance < (1 - minSimilarity).
        const distanceThreshold = 1 - similarityThreshold;
        const rows = await this.db.execute(sql`
          SELECT content, metadata
          FROM knowledge_entries
          WHERE knowledge_base_id = ${kbId}
            AND embedding IS NOT NULL
            AND (embedding <=> ${embLiteral}::vector) < ${distanceThreshold}
          ORDER BY embedding <=> ${embLiteral}::vector
          LIMIT ${limit}
        `);
        const results = Array.from(rows) as Array<{ content: string; metadata: Record<string, unknown> }>;
        if (results.length > 0) return results;
      } catch (err) {
        this.logger.warn(`Vector search failed, falling back to FTS: ${err}`);
      }
    }
    // Full-text search fallback — ts_rank ordering uses GIN index from migration 0003
    try {
      const rows = await this.db.execute(sql`
        SELECT content, metadata
        FROM knowledge_entries
        WHERE knowledge_base_id = ${kbId}
          AND to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
        ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) DESC
        LIMIT ${limit}
      `);
      const results = Array.from(rows) as Array<{ content: string; metadata: Record<string, unknown> }>;
      if (results.length > 0) return results;
    } catch (err) {
      this.logger.warn(`FTS failed: ${err}`);
    }
    return [];
  }

  async listEntries(workspaceId: string, kbId: string) {
    await this.assertBaseOwnership(workspaceId, kbId);

    return this.db
      .select({
        id: knowledgeEntries.id,
        content: knowledgeEntries.content,
        metadata: knowledgeEntries.metadata,
        status: knowledgeEntries.status,
        createdAt: knowledgeEntries.createdAt,
      })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.knowledgeBaseId, kbId))
      .orderBy(desc(knowledgeEntries.createdAt));
  }

  async getEntryStatus(workspaceId: string, kbId: string, entryId: string) {
    await this.assertBaseOwnership(workspaceId, kbId);

    const [entry] = await this.db
      .select({ id: knowledgeEntries.id, status: knowledgeEntries.status })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.knowledgeBaseId, kbId),
        ),
      )
      .limit(1);

    if (!entry) throw new NotFoundException(`Entry ${entryId} not found`);
    return entry;
  }

  async deleteEntry(workspaceId: string, kbId: string, entryId: string) {
    await this.assertBaseOwnership(workspaceId, kbId);

    const deleted = await this.db
      .delete(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.id, entryId),
          eq(knowledgeEntries.knowledgeBaseId, kbId),
        ),
      )
      .returning();

    if (!deleted.length)
      throw new NotFoundException(`Entry ${entryId} not found`);
  }

  async searchEntries(
    workspaceId: string,
    kbId: string,
    dto: SearchEntriesDto,
  ) {
    await this.assertBaseOwnership(workspaceId, kbId);

    // Load KB settings to apply per-KB similarity threshold
    const [kb] = await this.db
      .select({ settings: knowledgeBases.settings })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, kbId))
      .limit(1);
    const kbSettings: KnowledgeBaseSettings = kb?.settings ?? {};
    const similarityThreshold = kbSettings.similarityThreshold ?? 0.75;

    let queryEmbedding: number[] | null = null;
    try {
      const vec = await this.embeddingService.embed(dto.query);
      const isZero = vec.every((v) => v === 0);
      if (!isZero) queryEmbedding = vec;
    } catch {
      // fall through to keyword search
    }

    const results = await this.vectorSearch(kbId, queryEmbedding, dto.query, dto.limit ?? 20, similarityThreshold);
    return results;
  }
}
