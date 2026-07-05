import { Injectable, Inject } from '@nestjs/common';
import { and, desc, eq, gte } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { auditLogs, users } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';

export interface LogEventOptions {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  resourceName?: string | null;
  metadata?: Record<string, unknown>;
}

type Period = '24h' | '7d' | '30d' | string;

function periodToDate(period: Period): Date | null {
  const now = new Date();
  if (period === '24h') return new Date(now.getTime() - 86_400_000);
  if (period === '7d') return new Date(now.getTime() - 7 * 86_400_000);
  if (period === '30d') return new Date(now.getTime() - 30 * 86_400_000);
  return null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async log(opts: LogEventOptions): Promise<void> {
    const metadata: Record<string, unknown> = { ...opts.metadata };
    if (opts.resourceName) metadata['resourceName'] = opts.resourceName;

    await this.db.insert(auditLogs).values({
      workspaceId: opts.workspaceId,
      actorId: opts.actorId ?? null,
      action: opts.action,
      resourceType: opts.resourceType ?? null,
      resourceId: opts.resourceId ?? null,
      metadata,
    });
  }

  async findAll(workspaceId: string, period?: Period, resourceType?: string) {
    const since = period ? periodToDate(period) : null;

    const conditions = [eq(auditLogs.workspaceId, workspaceId)];
    if (since) conditions.push(gte(auditLogs.createdAt, since));
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType));

    const rows = await this.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorId: auditLogs.actorId,
        actorEmail: users.email,
        actorName: users.name,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(500);

    return rows.map((r) => ({
      id: r.id,
      actorId: r.actorId,
      actorEmail: r.actorEmail ?? 'system',
      actorName: r.actorName ?? null,
      action: r.action,
      resourceType: r.resourceType ?? '',
      resourceId: r.resourceId ?? null,
      resourceName: (r.metadata?.['resourceName'] as string | null) ?? null,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));
  }
}
