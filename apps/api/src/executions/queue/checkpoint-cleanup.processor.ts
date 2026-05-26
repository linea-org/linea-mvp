import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';

export const CLEANUP_QUEUE = 'cleanup';

@Processor(CLEANUP_QUEUE)
export class CheckpointCleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CheckpointCleanupProcessor.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {
    super();
  }

  async process(): Promise<void> {
    const retentionDays = parseInt(
      this.config.get<string>('CHECKPOINT_RETENTION_DAYS') ?? '30',
    );
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

    const result = await this.db.execute(sql`
      DELETE FROM checkpoints
      WHERE thread_id IN (
        SELECT thread_id FROM executions
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND updated_at < ${cutoff}
      )
    `);

    await this.db.execute(sql`
      DELETE FROM checkpoint_writes
      WHERE thread_id IN (
        SELECT thread_id FROM executions
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND updated_at < ${cutoff}
      )
    `);

    await this.db.execute(sql`
      DELETE FROM checkpoint_blobs
      WHERE thread_id IN (
        SELECT thread_id FROM executions
        WHERE status IN ('completed', 'failed', 'cancelled')
        AND updated_at < ${cutoff}
      )
    `);

    const deletedCount = (result as any).rowCount ?? 0;
    this.logger.log(
      `Checkpoint cleanup: removed ${deletedCount} checkpoint rows older than ${retentionDays} days`,
    );
  }
}
