import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { resourceQuotas } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

@Injectable()
export class QuotasService {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

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
  }

  async incrementUsed(workspaceId: string): Promise<void> {
    await this.db
      .update(resourceQuotas)
      .set({
        executionsUsed: sql`executions_used + 1`,
        updatedAt: new Date(),
      })
      .where(eq(resourceQuotas.workspaceId, workspaceId));
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
