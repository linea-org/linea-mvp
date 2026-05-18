import { Injectable, Inject, Logger } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, ilike, count, desc, sql } from 'drizzle-orm';
import type { DrizzleDB, NewKnowledgeBase, NewKnowledgeEntry } from '@linea/db';
import { knowledgeBases, knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import type { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { SearchEntriesDto } from './dto/search-entries.dto';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;
    try {
      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
      });
      const json = (await resp.json()) as { data?: [{ embedding: number[] }]; error?: { message: string } };
      if (!resp.ok || !json.data?.[0]) {
        this.logger.warn(`Embedding API error: ${json.error?.message ?? resp.status}`);
        return null;
      }
      return json.data[0].embedding;
    } catch (err) {
      this.logger.warn(`generateEmbedding failed: ${err}`);
      return null;
    }
  }

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

    const embedding = await this.generateEmbedding(dto.content);

    const [entry] = await this.db
      .insert(knowledgeEntries)
      .values({
        knowledgeBaseId: kbId,
        content: dto.content,
        embedding: embedding ?? undefined,
        metadata: dto.metadata ?? {},
      } satisfies Partial<NewKnowledgeEntry> as NewKnowledgeEntry)
      .returning();

    await this.db
      .update(knowledgeBases)
      .set({ updatedAt: new Date() })
      .where(eq(knowledgeBases.id, kbId));

    return entry;
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

    const limit = dto.limit ?? 10;

    // Attempt vector similarity search if embeddings are available
    const queryEmbedding = dto.query ? await this.generateEmbedding(dto.query) : null;
    if (queryEmbedding) {
      const vec = `[${queryEmbedding.join(',')}]`;
      const rows = await this.db.execute(sql`
        SELECT id, content, metadata, created_at,
               1 - (embedding <=> ${vec}::vector) AS score
        FROM knowledge_entries
        WHERE knowledge_base_id = ${kbId}
          AND embedding IS NOT NULL
        ORDER BY embedding <=> ${vec}::vector
        LIMIT ${limit}
      `);
      if (Array.from(rows).length > 0) {
        return Array.from(rows).map((r: any) => ({
          id: r.id as string,
          content: r.content as string,
          metadata: r.metadata as Record<string, unknown>,
          createdAt: r.created_at as Date,
          score: Number(r.score),
        }));
      }
    }

    // Fallback: keyword search (no OpenAI key or no embeddings stored yet)
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
          dto.query ? ilike(knowledgeEntries.content, `%${dto.query}%`) : undefined,
        ),
      )
      .limit(limit);
  }
}
