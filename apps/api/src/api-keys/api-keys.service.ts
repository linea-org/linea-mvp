import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { lineaApiKeys } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(workspaceId: string, userId: string, dto: CreateApiKeyDto) {
    const rawKey = `lnk_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const [record] = await this.db
      .insert(lineaApiKeys)
      .values({ workspaceId, userId, keyHash, label: dto.label ?? null })
      .returning();

    return { ...record, key: rawKey };
  }

  async findAll(workspaceId: string) {
    return this.db
      .select({
        id: lineaApiKeys.id,
        label: lineaApiKeys.label,
        lastUsedAt: lineaApiKeys.lastUsedAt,
        createdAt: lineaApiKeys.createdAt,
      })
      .from(lineaApiKeys)
      .where(eq(lineaApiKeys.workspaceId, workspaceId));
  }

  async revoke(workspaceId: string, id: string) {
    const [row] = await this.db
      .select({ id: lineaApiKeys.id })
      .from(lineaApiKeys)
      .where(
        and(eq(lineaApiKeys.id, id), eq(lineaApiKeys.workspaceId, workspaceId)),
      )
      .limit(1);

    if (!row) throw new NotFoundException(`API key ${id} not found`);

    await this.db.delete(lineaApiKeys).where(eq(lineaApiKeys.id, id));
  }
}
