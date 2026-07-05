import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { resourceQuotas } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';
import { NotificationsService } from '../notifications/notifications.service.js';

const QUOTA_ALERT_THRESHOLDS = [0.8, 1];

@Injectable()
export class QuotasService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly notifications: NotificationsService,
  ) {}

  async getOrCreate(workspaceId: string) {
    const [row] = await this.db
      .select()
      .from(resourceQuotas)
      .where(eq(resourceQuotas.workspaceId, workspaceId))
      .limit(1);

    if (row) return row;

    const resetAt = new Date();
    resetAt.setMonth(resetAt.getMonth() + 1);
    resetAt.setDate(1);
    resetAt.setHours(0, 0, 0, 0);

    const [created] = await this.db
      .insert(resourceQuotas)
      .values({ workspaceId, resetAt })
      .returning();

    return created;
  }

  async checkLimit(workspaceId: string): Promise<void> {
    let quota = await this.getOrCreate(workspaceId);

    if (new Date() >= quota.resetAt) {
      const [reset] = await this.db
        .update(resourceQuotas)
        .set({
          executionsUsed: 0,
          tokensUsedMonth: 0,
          burstMinutesUsed: '0',
          resetAt: this.nextMonthReset(),
          updatedAt: new Date(),
        })
        .where(eq(resourceQuotas.workspaceId, workspaceId))
        .returning();
      quota = reset;
    }

    if (quota.executionsUsed >= quota.executionsPerMonth) {
      throw new ForbiddenException(
        `Execution quota exceeded (${quota.executionsUsed}/${quota.executionsPerMonth} this month)`,
      );
    }

    if (quota.tokensUsedMonth >= quota.tokensPerMonth) {
      throw new ForbiddenException(
        `Token quota exceeded (${quota.tokensUsedMonth.toLocaleString()}/${quota.tokensPerMonth.toLocaleString()} tokens this month)`,
      );
    }
  }

  async incrementUsed(
    workspaceId: string,
    tokensConsumed = 0,
    userId?: string,
  ): Promise<void> {
    const before = await this.getOrCreate(workspaceId);

    const [after] = await this.db
      .update(resourceQuotas)
      .set({
        executionsUsed: sql`executions_used + 1`,
        tokensUsedMonth: sql`tokens_used_month + ${tokensConsumed}`,
        updatedAt: new Date(),
      })
      .where(eq(resourceQuotas.workspaceId, workspaceId))
      .returning();

    if (userId && after)
      this.notifyIfThresholdCrossed(userId, workspaceId, before, after);
  }

  private notifyIfThresholdCrossed(
    userId: string,
    workspaceId: string,
    before: typeof resourceQuotas.$inferSelect,
    after: typeof resourceQuotas.$inferSelect,
  ): void {
    for (const [label, usedBefore, usedAfter, limit] of [
      [
        'executions',
        before.executionsUsed,
        after.executionsUsed,
        after.executionsPerMonth,
      ],
      [
        'tokens',
        before.tokensUsedMonth,
        after.tokensUsedMonth,
        after.tokensPerMonth,
      ],
    ] as const) {
      for (const threshold of QUOTA_ALERT_THRESHOLDS) {
        const boundary = threshold * limit;
        if (usedBefore < boundary && usedAfter >= boundary) {
          void this.notifications.create(
            userId,
            'quota_threshold',
            threshold >= 1
              ? `${label} quota reached`
              : `${label} quota nearing limit`,
            `Workspace has used ${usedAfter.toLocaleString()}/${limit.toLocaleString()} ${label} this month (${Math.round(threshold * 100)}%).`,
            workspaceId,
          );
        }
      }
    }
  }

  async getQuota(workspaceId: string) {
    return this.getOrCreate(workspaceId);
  }

  private nextMonthReset(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
}
