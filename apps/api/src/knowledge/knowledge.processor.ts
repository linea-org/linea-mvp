import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { RAG_EMBED_QUEUE } from './knowledge.queue';
import type { RagEmbedJobData } from './knowledge.queue';
import { AIService } from '../services/ai/ai.service';

@Processor(RAG_EMBED_QUEUE)
export class KnowledgeEmbedProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeEmbedProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly ai: AIService,
  ) {
    super();
  }

  async process(job: Job<RagEmbedJobData>): Promise<void> {
    const { entryId, content, embeddingModel, workspaceId, provider } =
      job.data;

    this.logger.debug(
      `Embedding entry ${entryId} with model ${embeddingModel}`,
    );

    // Mark as 'embedding' so the UI can show a spinner during processing
    await this.db
      .update(knowledgeEntries)
      .set({ status: 'embedding' })
      .where(eq(knowledgeEntries.id, entryId));

    try {
      const client = await this.ai.initialize(workspaceId, provider);

      // text-embedding-005
      const vec = await client.embedding('text-embedding-005', content);
      if (vec == null) {
        throw new Error('Failed to generate embeddings');
      }
      const isZero = vec.every((v) => v === 0);

      await this.db
        .update(knowledgeEntries)
        .set({
          embedding: isZero ? undefined : vec,
          status: 'indexed',
        })
        .where(eq(knowledgeEntries.id, entryId));

      this.logger.debug(
        `Entry ${entryId} embedded successfully (zero=${isZero})`,
      );
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
