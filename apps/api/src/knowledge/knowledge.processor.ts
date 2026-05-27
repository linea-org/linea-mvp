import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { EmbeddingService } from '../memory/embedding.service';
import { RAG_EMBED_QUEUE } from './knowledge.queue';
import type { RagEmbedJobData } from './knowledge.queue';

@Processor(RAG_EMBED_QUEUE)
export class KnowledgeEmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeEmbedProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly embeddingService: EmbeddingService,
  ) {
    super();
  }

  async process(job: Job<RagEmbedJobData>): Promise<void> {
    const { entryId, content, embeddingModel } = job.data;

    this.logger.debug(`Embedding entry ${entryId} with model ${embeddingModel}`);

    // Mark as 'embedding' so the UI can show a spinner during processing
    await this.db
      .update(knowledgeEntries)
      .set({ status: 'embedding' })
      .where(eq(knowledgeEntries.id, entryId));

    try {
      // EmbeddingService falls back to system OPENAI_API_KEY if no override provided
      // BYOK support: future enhancement to pass workspace-level key
      const vec = await this.embeddingService.embed(content, embeddingModel);
      const isZero = vec.every((v) => v === 0);

      await this.db
        .update(knowledgeEntries)
        .set({
          embedding: isZero ? undefined : vec,
          status: 'indexed',
        })
        .where(eq(knowledgeEntries.id, entryId));

      this.logger.debug(`Entry ${entryId} embedded successfully (zero=${isZero})`);
    } catch (err) {
      this.logger.error(`Failed to embed entry ${entryId}: ${err}`);
      await this.db
        .update(knowledgeEntries)
        .set({ status: 'failed' })
        .where(eq(knowledgeEntries.id, entryId));
      // Re-throw so BullMQ retries the job with exponential backoff
      throw err;
    }
  }
}
