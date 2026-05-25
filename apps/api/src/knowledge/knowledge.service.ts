import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, count, desc, sql } from 'drizzle-orm';
import type { DrizzleDB, NewKnowledgeBase, NewKnowledgeEntry } from '@linea/db';
import { knowledgeBases, knowledgeEntries, workspaces } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { EmbeddingService } from '../memory/embedding.service';
import type { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import type { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { SearchEntriesDto } from './dto/search-entries.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly embeddingService: EmbeddingService,
  ) {}

  // ─── Knowledge Bases ────────────────────────────────────────────────────────

  async createBase(workspaceId: string, dto: CreateKnowledgeBaseDto) {
    const [kb] = await this.db
      .insert(knowledgeBases)
      .values({
        workspaceId,
        name: dto.name,
        description: dto.description ?? null,
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

  private splitIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
    if (text.length <= chunkSize) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      if (end === text.length) break;
      start += chunkSize - overlap;
    }
    return chunks;
  }

  async addEntry(workspaceId: string, kbId: string, dto: CreateEntryDto) {
    await this.assertBaseOwnership(workspaceId, kbId);

    // Load workspace RAG settings (chunk size / overlap)
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    const wsSettings = ws?.settings ?? {};
    const CHUNK_SIZE = wsSettings.ragChunkSize ?? 1000;
    const CHUNK_OVERLAP = wsSettings.ragChunkOverlap ?? 200;
    const chunks = this.splitIntoChunks(dto.content, CHUNK_SIZE, CHUNK_OVERLAP);

    const sourceId = chunks.length > 1 ? crypto.randomUUID() : null;
    const totalChunks = chunks.length > 1 ? chunks.length : null;

    const inserted: NewKnowledgeEntry[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;

      let embedding: number[] | undefined;
      try {
        const vec = await this.embeddingService.embed(chunk);
        const isZero = vec.every((v) => v === 0);
        if (!isZero) embedding = vec;
      } catch (err) {
        this.logger.warn(`Failed to embed chunk ${i}: ${err}`);
      }

      const [entry] = await this.db
        .insert(knowledgeEntries)
        .values({
          knowledgeBaseId: kbId,
          content: chunk,
          embedding,
          metadata: dto.metadata ?? {},
          sourceId,
          chunkIndex: chunks.length > 1 ? i : null,
          totalChunks,
        } satisfies Partial<NewKnowledgeEntry> as NewKnowledgeEntry)
        .returning();

      inserted.push(entry);
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
        createdAt: knowledgeEntries.createdAt,
      })
      .from(knowledgeEntries)
      .where(eq(knowledgeEntries.knowledgeBaseId, kbId))
      .orderBy(desc(knowledgeEntries.createdAt));
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

    let queryEmbedding: number[] | null = null;
    try {
      const vec = await this.embeddingService.embed(dto.query);
      const isZero = vec.every((v) => v === 0);
      if (!isZero) queryEmbedding = vec;
    } catch {
      // fall through to keyword search
    }

    const results = await this.vectorSearch(kbId, queryEmbedding, dto.query, dto.limit ?? 20);
    return results;
  }
}
