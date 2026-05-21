import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { and, eq, ilike, count, desc, sql } from 'drizzle-orm';
import type { DrizzleDB, NewKnowledgeBase, NewKnowledgeEntry } from '@linea/db';
import { knowledgeBases, knowledgeEntries } from '@linea/db';
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

  async addEntry(workspaceId: string, kbId: string, dto: CreateEntryDto) {
    await this.assertBaseOwnership(workspaceId, kbId);

    let embedding: number[] | undefined;
    try {
      const vec = await this.embeddingService.embed(dto.content);
      // A zero-vector means the API key is missing or the model doesn't match — skip storage
      const isZero = vec.every((v) => v === 0);
      if (!isZero) embedding = vec;
    } catch (err) {
      this.logger.warn(`Failed to embed entry content: ${err}`);
    }

    const [entry] = await this.db
      .insert(knowledgeEntries)
      .values({
        knowledgeBaseId: kbId,
        content: dto.content,
        embedding,
        metadata: dto.metadata ?? {},
      } satisfies Partial<NewKnowledgeEntry> as NewKnowledgeEntry)
      .returning();

    await this.db
      .update(knowledgeBases)
      .set({ updatedAt: new Date() })
      .where(eq(knowledgeBases.id, kbId));

    return entry;
  }

  /**
   * Vector-similarity search against embedded entries.
   * Falls back to keyword search when no embeddings are stored or when the
   * query embedding is unavailable.
   */
  async vectorSearch(
    kbId: string,
    queryEmbedding: number[] | null,
    query: string,
    limit: number,
  ): Promise<Array<{ content: string; metadata: Record<string, unknown> }>> {
    if (queryEmbedding) {
      try {
        const embLiteral = `[${queryEmbedding.join(',')}]`;
        const rows = await this.db.execute(sql`
          SELECT content, metadata
          FROM knowledge_entries
          WHERE knowledge_base_id = ${kbId} AND embedding IS NOT NULL
          ORDER BY embedding <=> ${embLiteral}::vector
          LIMIT ${limit}
        `);
        const results = Array.from(rows) as Array<{ content: string; metadata: Record<string, unknown> }>;
        if (results.length > 0) return results;
      } catch (err) {
        this.logger.warn(`Vector search failed, falling back to keyword search: ${err}`);
      }
    }
    // Keyword fallback
    return this.db
      .select({ content: knowledgeEntries.content, metadata: knowledgeEntries.metadata })
      .from(knowledgeEntries)
      .where(and(eq(knowledgeEntries.knowledgeBaseId, kbId), ilike(knowledgeEntries.content, `%${query}%`)))
      .limit(limit) as Promise<Array<{ content: string; metadata: Record<string, unknown> }>>;
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

    // vectorSearch returns { content, metadata } — re-select with id/createdAt when falling back
    if (queryEmbedding && results.length > 0) return results;

    return this.db
      .select({
        id: knowledgeEntries.id,
        content: knowledgeEntries.content,
        metadata: knowledgeEntries.metadata,
        createdAt: knowledgeEntries.createdAt,
      })
      .from(knowledgeEntries)
      .where(
        and(
          eq(knowledgeEntries.knowledgeBaseId, kbId),
          ilike(knowledgeEntries.content, `%${dto.query}%`),
        ),
      )
      .limit(dto.limit ?? 20);
  }
}
