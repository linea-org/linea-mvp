import { Injectable, Inject } from '@nestjs/common';
import { and, count, desc, eq, gte, lte } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { auditLogs, users } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

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

export interface FindAuditLogsPaginatedOptions {
  page?: number;
  limit?: number;
  action?: string;
  from?: Date | null;
  to?: Date | null;
}

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
        actorAvatarUrl: users.avatarUrl,
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
      actorAvatarUrl: r.actorAvatarUrl ?? null,
      action: r.action,
      resourceType: r.resourceType ?? '',
      resourceId: r.resourceId ?? null,
      resourceName: (r.metadata?.['resourceName'] as string | null) ?? null,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }));
  }

  async findAllPaginated(
    workspaceId: string,
    options: FindAuditLogsPaginatedOptions = {},
  ) {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 50));
    const conditions = [eq(auditLogs.workspaceId, workspaceId)];

    if (options.action) conditions.push(eq(auditLogs.action, options.action));
    if (options.from) conditions.push(gte(auditLogs.createdAt, options.from));
    if (options.to) conditions.push(lte(auditLogs.createdAt, options.to));

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(auditLogs)
      .where(and(...conditions));

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
        actorAvatarUrl: users.avatarUrl,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const actionRows = await this.db
      .select({ action: auditLogs.action })
      .from(auditLogs)
      .where(eq(auditLogs.workspaceId, workspaceId))
      .groupBy(auditLogs.action)
      .orderBy(auditLogs.action);

    return {
      items: rows.map((r) => ({
        id: r.id,
        actorId: r.actorId,
        actorEmail: r.actorEmail ?? 'system',
        actorName: r.actorName ?? null,
        actorAvatarUrl: r.actorAvatarUrl ?? null,
        action: r.action,
        resourceType: r.resourceType ?? '',
        resourceId: r.resourceId ?? null,
        resourceName: (r.metadata?.['resourceName'] as string | null) ?? null,
        metadata: r.metadata,
        createdAt: r.createdAt,
      })),
      actionTypes: actionRows.map((r) => r.action),
      meta: { page, limit, total: total ?? 0 },
    };
  }
}
