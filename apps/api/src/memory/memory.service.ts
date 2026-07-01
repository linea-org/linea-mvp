import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, desc, isNull, sql } from 'drizzle-orm';
import type { DrizzleDB, NewMemory } from '@linea/db';
import { memories, memorySessions } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateMemoryDto } from './dto/create-memory.dto';
import type { ListMemoriesDto } from './dto/list-memories.dto';
import type { IngestMemoryDto } from './dto/ingest-memory.dto';
import type { SearchMemoryDto } from './dto/search-memory.dto';
import { ExtractionService } from './extraction.service';
import { AIService } from '../services/ai/ai.service';

const SUPERSEDE_THRESHOLD = 0.88;
const CANDIDATE_POOL = 20;

@Injectable()
export class MemoryService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly ai: AIService,
    private readonly extraction: ExtractionService,
  ) {}

  async ingest(workspaceId: string, userId: string, dto: IngestMemoryDto) {
    const facts = await this.extraction.extract(dto.content);
    const createdIds: string[] = [];
    const updatedIds: string[] = [];

    const client = await this.ai.initializeWithSys('google');

    for (const fact of facts) {
      // text-embedding-005
      const vec = await client.embedding('text-embedding-005', fact.content);
      if (vec == null) {
        throw new Error('Failed to generate embeddings');
      }
      const vecStr = this.toVectorString(vec);
      const neighbor = await this.db.execute<{
        id: string;
        similarity: number;
      }>(
        sql`
          SELECT id, 1 - (embedding <=> ${vecStr}::vector) AS similarity
          FROM memories
          WHERE workspace_id = ${workspaceId}
            AND superseded_by_id IS NULL
          ORDER BY embedding <=> ${vecStr}::vector
          LIMIT 1
        `,
      );

      const top = (
        neighbor as unknown as { id: string; similarity: number }[]
      )[0];

      if (top && top.similarity >= SUPERSEDE_THRESHOLD) {
        const [inserted] = await this.db
          .insert(memories)
          .values({
            workspaceId,
            userId,
            scope: dto.scope ?? 'user',
            content: fact.content,
            embedding: vec,
            source: 'extracted',
            factType: fact.factType ?? null,
            confidence: fact.confidence ?? 1.0,
            eventDate: fact.eventDate ? new Date(fact.eventDate) : null,
            threadId: dto.threadId ?? null,
            workflowId: dto.workflowId ?? null,
            metadata: {},
          } satisfies Partial<NewMemory> as NewMemory)
          .returning({ id: memories.id });

        await this.db
          .update(memories)
          .set({ supersededById: inserted.id })
          .where(eq(memories.id, top.id));

        createdIds.push(inserted.id);
        updatedIds.push(top.id);
      } else {
        const [inserted] = await this.db
          .insert(memories)
          .values({
            workspaceId,
            userId,
            scope: dto.scope ?? 'user',
            content: fact.content,
            embedding: vec,
            source: 'extracted',
            factType: fact.factType ?? null,
            confidence: fact.confidence ?? 1.0,
            eventDate: fact.eventDate ? new Date(fact.eventDate) : null,
            threadId: dto.threadId ?? null,
            workflowId: dto.workflowId ?? null,
            metadata: {},
          } satisfies Partial<NewMemory> as NewMemory)
          .returning({ id: memories.id });

        createdIds.push(inserted.id);
      }
    }

    const [session] = await this.db
      .insert(memorySessions)
      .values({
        workspaceId,
        rawContent: dto.content,
        memoriesExtracted: createdIds,
        memoriesUpdated: updatedIds,
      })
      .returning();

    const inserted = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          sql`${memories.id} = ANY(${createdIds})`,
        ),
      );

    return {
      memoriesCreated: createdIds.length,
      memoriesUpdated: updatedIds.length,
      sessionId: session.id,
      memories: inserted,
    };
  }

  async search(workspaceId: string, dto: SearchMemoryDto) {
    const limit = dto.limit ?? 10;

    const client = await this.ai.initializeWithSys('google');
    const vec = await client.embedding('text-embedding-005', dto.query);
    if (vec == null) {
      throw new Error('Failed to generate embeddings');
    }
    const vecStr = this.toVectorString(vec);
    // Build parameterized WHERE clause — never interpolate user values into sql.raw
    const scopeFilter = dto.scope ? sql`AND m.scope = ${dto.scope}` : sql``;
    const userFilter = dto.userId ? sql`AND m.user_id = ${dto.userId}` : sql``;
    const threadFilter = dto.threadId
      ? sql`AND m.thread_id = ${dto.threadId}`
      : sql``;
    // Cap query length to prevent expensive ILIKE scans
    const safeQuery = String(dto.query ?? '').slice(0, 200);

    const vectorResults = (await this.db.execute<{
      id: string;
      similarity: number;
    }>(
      sql`
        SELECT id, 1 - (embedding <=> ${vecStr}::vector) AS similarity
        FROM memories m
        WHERE m.workspace_id = ${workspaceId}
          AND m.superseded_by_id IS NULL
          ${scopeFilter} ${userFilter} ${threadFilter}
        ORDER BY embedding <=> ${vecStr}::vector
        LIMIT ${CANDIDATE_POOL}
      `,
    )) as unknown as { id: string; similarity: number }[];

    const keywordResults = (await this.db.execute<{ id: string }>(
      sql`
        SELECT id FROM memories m
        WHERE m.workspace_id = ${workspaceId}
          AND m.superseded_by_id IS NULL
          ${scopeFilter} ${userFilter} ${threadFilter}
          AND content ILIKE ${'%' + safeQuery + '%'}
        LIMIT ${CANDIDATE_POOL}
      `,
    )) as unknown as { id: string }[];

    const keywordIds = new Set(keywordResults.map((r) => r.id));

    const scoreMap = new Map<string, number>();
    for (const row of vectorResults) {
      scoreMap.set(row.id, row.similarity);
    }
    for (const row of keywordResults) {
      const existing = scoreMap.get(row.id);
      if (existing !== undefined) {
        scoreMap.set(row.id, existing + 0.2);
      } else {
        scoreMap.set(row.id, 0.3);
      }
    }

    const allIds = [
      ...new Set([...vectorResults.map((r) => r.id), ...keywordIds]),
    ];
    if (allIds.length === 0) return [];

    const rows = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          sql`${memories.id} = ANY(${allIds})`,
        ),
      );

    return rows
      .map((m) => ({ ...m, score: scoreMap.get(m.id) ?? 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async getProfile(workspaceId: string, userId: string) {
    const rows = await this.db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.workspaceId, workspaceId),
          eq(memories.userId, userId),
          eq(memories.scope, 'user'),
          isNull(memories.supersededById),
        ),
      )
      .orderBy(desc(memories.createdAt));

    const grouped: Record<string, typeof rows> = {
      facts: [],
      preferences: [],
      events: [],
      profile: [],
      system: [],
      uncategorized: [],
    };

    for (const row of rows) {
      const key = row.factType ?? 'uncategorized';
      const bucket =
        key === 'fact'
          ? 'facts'
          : key === 'preference'
            ? 'preferences'
            : key === 'event'
              ? 'events'
              : key === 'profile'
                ? 'profile'
                : key === 'system'
                  ? 'system'
                  : 'uncategorized';
      grouped[bucket].push(row);
    }

    return grouped;
  }

  async create(workspaceId: string, userId: string, dto: CreateMemoryDto) {
    const [memory] = await this.db
      .insert(memories)
      .values({
        workspaceId,
        userId,
        scope: dto.scope,
        content: dto.content,
        threadId: dto.threadId ?? null,
        workflowId: dto.workflowId ?? null,
        source: 'manual',
        metadata: {},
      } satisfies Partial<NewMemory> as NewMemory)
      .returning();
    return memory;
  }

  async findAll(workspaceId: string, query: ListMemoriesDto) {
    const conditions = [
      eq(memories.workspaceId, workspaceId),
      isNull(memories.supersededById),
    ];
    if (query.scope) conditions.push(eq(memories.scope, query.scope));
    if (query.threadId) conditions.push(eq(memories.threadId, query.threadId));
    if (query.workflowId)
      conditions.push(eq(memories.workflowId, query.workflowId));

    return this.db
      .select()
      .from(memories)
      .where(and(...conditions))
      .orderBy(desc(memories.createdAt));
  }

  async delete(workspaceId: string, id: string) {
    const deleted = await this.db
      .delete(memories)
      .where(and(eq(memories.id, id), eq(memories.workspaceId, workspaceId)))
      .returning();

    if (!deleted.length) throw new NotFoundException(`Memory ${id} not found`);
  }

  toVectorString(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
