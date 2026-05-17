import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { lineaApiKeys } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateApiKeyDto } from './dto/create-api-key.dto';

const EXPIRY_MS: Record<string, number> = {
  '30d':  30  * 86_400_000,
  '90d':  90  * 86_400_000,
  '365d': 365 * 86_400_000,
};

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async create(workspaceId: string, userId: string, dto: CreateApiKeyDto) {
    const rawKey = `lnk_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const expiresAt = dto.expiresIn && dto.expiresIn !== 'never'
      ? new Date(Date.now() + EXPIRY_MS[dto.expiresIn]!)
      : null;

    const [record] = await this.db
      .insert(lineaApiKeys)
      .values({ workspaceId, userId, keyHash, label: dto.label ?? null, expiresAt })
      .returning();

    return { ...record, key: rawKey };
  }

  async findAll(workspaceId: string) {
    const rows = await this.db
      .select({
        id: lineaApiKeys.id,
        label: lineaApiKeys.label,
        lastUsedAt: lineaApiKeys.lastUsedAt,
        expiresAt: lineaApiKeys.expiresAt,
        revokedAt: lineaApiKeys.revokedAt,
        createdAt: lineaApiKeys.createdAt,
      })
      .from(lineaApiKeys)
      .where(and(
        eq(lineaApiKeys.workspaceId, workspaceId),
        isNull(lineaApiKeys.revokedAt),
      ));

    const now = new Date();
    return rows.map((r) => ({
      ...r,
      status: r.expiresAt && r.expiresAt < now ? 'expired' : 'active',
    }));
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

    await this.db
      .update(lineaApiKeys)
      .set({ revokedAt: new Date() })
      .where(eq(lineaApiKeys.id, id));
  }
}
