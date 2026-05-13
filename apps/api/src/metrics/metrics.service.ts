import { Injectable, Inject } from '@nestjs/common';
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
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async getWorkspaceMetrics(workspaceId: string, period: '24h' | '7d' | '30d' = '7d') {
    const cutoff = new Date(Date.now() - PERIOD_HOURS[period] * 60 * 60 * 1000);

    const statsRows = Array.from(
      await this.db.execute(sql`
        SELECT
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE status = 'completed')        AS completed,
          COUNT(*) FILTER (WHERE status = 'failed')           AS failed,
          COUNT(*) FILTER (WHERE status = 'running')          AS running,
          COUNT(*) FILTER (WHERE status = 'queued')           AS queued,
          COUNT(*) FILTER (WHERE status = 'suspended')        AS suspended,
          COUNT(*) FILTER (WHERE status = 'cancelled')        AS cancelled,
          ROUND(AVG(
            CASE WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 END
          ))::bigint AS avg_ms,
          ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY CASE WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 END
          ))::bigint AS p50_ms,
          ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (
            ORDER BY CASE WHEN finished_at IS NOT NULL AND started_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (finished_at - started_at)) * 1000 END
          ))::bigint AS p95_ms
        FROM executions
        WHERE workspace_id = ${workspaceId}
          AND created_at >= ${cutoff}
      `,
      ),
    );

    const stats = statsRows[0] as Record<string, unknown> | undefined;

    const topWorkflowRows = Array.from(
      await this.db.execute(sql`
        SELECT
          e.workflow_id                                         AS "workflowId",
          w.name,
          COUNT(*)                                             AS total,
          COUNT(*) FILTER (WHERE e.status = 'completed')      AS completed,
          COUNT(*) FILTER (WHERE e.status = 'failed')         AS failed
        FROM executions e
        LEFT JOIN workflows w ON w.id = e.workflow_id
        WHERE e.workspace_id = ${workspaceId}
          AND e.workflow_id IS NOT NULL
          AND e.created_at >= ${cutoff}
        GROUP BY e.workflow_id, w.name
        ORDER BY total DESC
        LIMIT 10
      `,
      ),
    ) as Array<Record<string, unknown>>;

    const total = Number(stats?.total ?? 0);
    const completed = Number(stats?.completed ?? 0);
    const failed = Number(stats?.failed ?? 0);

    return {
      period,
      executions: {
        total,
        byStatus: {
          completed,
          failed,
          running: Number(stats?.running ?? 0),
          queued: Number(stats?.queued ?? 0),
          suspended: Number(stats?.suspended ?? 0),
          cancelled: Number(stats?.cancelled ?? 0),
        },
        successRate:
          completed + failed > 0
            ? Number(((completed / (completed + failed)) * 100).toFixed(1))
            : null,
      },
      duration: {
        avgMs: stats?.avg_ms != null ? Number(stats.avg_ms) : null,
        p50Ms: stats?.p50_ms != null ? Number(stats.p50_ms) : null,
        p95Ms: stats?.p95_ms != null ? Number(stats.p95_ms) : null,
      },
      topWorkflows: topWorkflowRows.map((r) => {
        const t = Number(r.total);
        const c = Number(r.completed);
        return {
          workflowId: r.workflowId as string,
          name: (r.name as string | null) ?? 'Deleted workflow',
          total: t,
          completed: c,
          failed: Number(r.failed),
          successRate: t > 0 ? Number(((c / t) * 100).toFixed(1)) : 0,
        };
      }),
    };
  }
}
