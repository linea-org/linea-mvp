import { Injectable, Inject, Logger } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

const PERIOD_HOURS: Record<string, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);

  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async getWorkspaceMetrics(
    workspaceId: string,
    period: '24h' | '7d' | '30d' = '7d',
  ) {
    const hours = PERIOD_HOURS[period] ?? PERIOD_HOURS['7d'];
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const cutoffIso = cutoff.toISOString();

    // Count stats — simple, safe aggregates
    const countRows = Array.from(
      await this.db.execute(sql`
        SELECT
          COUNT(*)                                        AS total,
          COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')      AS failed,
          COUNT(*) FILTER (WHERE status = 'running')     AS running,
          COUNT(*) FILTER (WHERE status = 'queued')      AS queued,
          COUNT(*) FILTER (WHERE status = 'suspended')   AS suspended,
          COUNT(*) FILTER (WHERE status = 'cancelled')   AS cancelled
        FROM executions
        WHERE workspace_id = ${workspaceId}::uuid
          AND created_at >= ${cutoffIso}::timestamptz
      `),
    );

    const counts = (countRows[0] ?? {}) as Record<string, unknown>;

    // Duration percentiles — only over rows that have both timestamps
    let durationStats: { avgMs: number | null; p50Ms: number | null; p95Ms: number | null } = {
      avgMs: null,
      p50Ms: null,
      p95Ms: null,
    };

    try {
      const durRows = Array.from(
        await this.db.execute(sql`
          WITH dur AS (
            SELECT
              date_part('epoch', finished_at - started_at) * 1000 AS ms
            FROM executions
            WHERE workspace_id = ${workspaceId}::uuid
              AND created_at >= ${cutoffIso}::timestamptz
              AND started_at IS NOT NULL
              AND finished_at IS NOT NULL
          )
          SELECT
            ROUND(AVG(ms))                                         AS avg_ms,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ms)) AS p50_ms,
            ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ms)) AS p95_ms
          FROM dur
        `),
      );
      const dur = (durRows[0] ?? {}) as Record<string, unknown>;
      const toMs = (v: unknown) => (v != null && !Number.isNaN(Number(v)) ? Number(v) : null);
      durationStats = {
        avgMs: toMs(dur['avg_ms']),
        p50Ms: toMs(dur['p50_ms']),
        p95Ms: toMs(dur['p95_ms']),
      };
    } catch (err) {
      this.logger.warn('Duration percentile query failed, returning nulls', err);
    }

    // Token usage totals
    let tokenStats: { totalInputTokens: number; totalOutputTokens: number; totalTokens: number } = {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalTokens: 0,
    };

    try {
      const tokenRows = Array.from(
        await this.db.execute(sql`
          SELECT
            COALESCE(SUM((token_usage->>'input')::bigint), 0)  AS total_input,
            COALESCE(SUM((token_usage->>'output')::bigint), 0) AS total_output,
            COALESCE(SUM((token_usage->>'total')::bigint), 0)  AS total_tokens
          FROM executions
          WHERE workspace_id = ${workspaceId}::uuid
            AND created_at >= ${cutoffIso}::timestamptz
            AND token_usage IS NOT NULL
        `),
      );
      const tr = (tokenRows[0] ?? {}) as Record<string, unknown>;
      tokenStats = {
        totalInputTokens: Number(tr['total_input'] ?? 0),
        totalOutputTokens: Number(tr['total_output'] ?? 0),
        totalTokens: Number(tr['total_tokens'] ?? 0),
      };
    } catch (err) {
      this.logger.warn('Token usage query failed, returning zeros', err);
    }

    // Top workflows breakdown
    const topWorkflowRows = Array.from(
      await this.db.execute(sql`
        SELECT
          e.workflow_id                                        AS workflow_id,
          w.name,
          COUNT(*)                                            AS total,
          COUNT(*) FILTER (WHERE e.status = 'completed')     AS completed,
          COUNT(*) FILTER (WHERE e.status = 'failed')        AS failed
        FROM executions e
        LEFT JOIN workflows w ON w.id = e.workflow_id
        WHERE e.workspace_id = ${workspaceId}::uuid
          AND e.workflow_id IS NOT NULL
          AND e.created_at >= ${cutoffIso}::timestamptz
        GROUP BY e.workflow_id, w.name
        ORDER BY total DESC
        LIMIT 10
      `),
    );

    const total = Number(counts['total'] ?? 0);
    const completed = Number(counts['completed'] ?? 0);
    const failed = Number(counts['failed'] ?? 0);

    return {
      period,
      executions: {
        total,
        byStatus: {
          completed,
          failed,
          running: Number(counts['running'] ?? 0),
          queued: Number(counts['queued'] ?? 0),
          suspended: Number(counts['suspended'] ?? 0),
          cancelled: Number(counts['cancelled'] ?? 0),
        },
        successRate:
          completed + failed > 0
            ? Number(((completed / (completed + failed)) * 100).toFixed(1))
            : null,
      },
      duration: durationStats,
      tokens: tokenStats,
      topWorkflows: topWorkflowRows.map((r) => {
        const row = r as Record<string, unknown>;
        const t = Number(row['total']);
        const c = Number(row['completed']);
        return {
          workflowId: row['workflow_id'] as string,
          name: (row['name'] as string | null) ?? 'Deleted workflow',
          total: t,
          completed: c,
          failed: Number(row['failed']),
          successRate: t > 0 ? Number(((c / t) * 100).toFixed(1)) : 0,
        };
      }),
    };
  }
}
