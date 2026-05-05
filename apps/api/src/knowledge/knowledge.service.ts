import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { and, eq, ilike, count, desc } from 'drizzle-orm';
import type { DrizzleDB, NewKnowledgeBase, NewKnowledgeEntry } from '@linea/db';
import { knowledgeBases, knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import type { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import type { CreateEntryDto } from './dto/create-entry.dto';
import type { SearchEntriesDto } from './dto/search-entries.dto';

@Injectable()
export class KnowledgeService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  // ─── Knowledge Bases ────────────────────────────────────────────────────────

  async createBase(workspaceId: string, dto: CreateKnowledgeBaseDto) {
    const [kb] = await this.db
      .insert(knowledgeBases)
      .values({ workspaceId, name: dto.name, description: dto.description ?? null } satisfies Partial<NewKnowledgeBase> as NewKnowledgeBase)
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
      .leftJoin(knowledgeEntries, eq(knowledgeEntries.knowledgeBaseId, knowledgeBases.id))
      .where(eq(knowledgeBases.workspaceId, workspaceId))
      .groupBy(knowledgeBases.id)
      .orderBy(desc(knowledgeBases.updatedAt));

    return rows;
  }

  async getBase(workspaceId: string, id: string) {
    const [kb] = await this.db
      .select()
      .from(knowledgeBases)
      .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.workspaceId, workspaceId)))
      .limit(1);

    if (!kb) throw new NotFoundException(`Knowledge base ${id} not found`);
    return kb;
  }

  async updateBase(workspaceId: string, id: string, dto: UpdateKnowledgeBaseDto) {
    await this.getBase(workspaceId, id);

    const [updated] = await this.db
      .update(knowledgeBases)
      .set({ ...dto, updatedAt: new Date() })
      .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.workspaceId, workspaceId)))
      .returning();

    return updated;
  }

  async deleteBase(workspaceId: string, id: string) {
    await this.getBase(workspaceId, id);
    await this.db
      .delete(knowledgeBases)
      .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.workspaceId, workspaceId)));
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

  private async assertBaseOwnership(workspaceId: string, kbId: string) {
    const [kb] = await this.db
      .select({ id: knowledgeBases.id })
      .from(knowledgeBases)
      .where(and(eq(knowledgeBases.id, kbId), eq(knowledgeBases.workspaceId, workspaceId)))
      .limit(1);

    if (!kb) throw new NotFoundException(`Knowledge base ${kbId} not found`);
  }

  async addEntry(workspaceId: string, kbId: string, dto: CreateEntryDto) {
    await this.assertBaseOwnership(workspaceId, kbId);

    const [entry] = await this.db
      .insert(knowledgeEntries)
      .values({
        knowledgeBaseId: kbId,
        content: dto.content,
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
      .where(and(eq(knowledgeEntries.id, entryId), eq(knowledgeEntries.knowledgeBaseId, kbId)))
      .returning();

    if (!deleted.length) throw new NotFoundException(`Entry ${entryId} not found`);
  }

  async searchEntries(workspaceId: string, kbId: string, dto: SearchEntriesDto) {
    await this.assertBaseOwnership(workspaceId, kbId);

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
      .limit(dto.limit);
  }
}
