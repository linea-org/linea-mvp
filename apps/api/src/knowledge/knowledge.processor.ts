import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';
import { RAG_EMBED_QUEUE } from './knowledge.queue.js';
import type { RagEmbedJobData } from './knowledge.queue.js';
import { AIService } from '../services/ai/ai.service.js';
import type { EmbeddingBucket } from '@linea/ai';

// Drizzle's typed .set() doesn't support a computed property name
function embeddingSetPayload(bucket: EmbeddingBucket, vec: number[]) {
  switch (bucket) {
    case 768:
      return { embedding768: vec };
    case 1536:
      return { embedding1536: vec };
  }
}

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
    const {
      entryId,
      content,
      embeddingModel,
      workspaceId,
      provider,
      dimensions,
    } = job.data;

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

      // Use the KB's locked model instead of a hardcoded one
      const vec = await client.embedding(embeddingModel, content);
      if (vec == null) {
        throw new Error('Failed to generate embeddings');
      }
      if (vec.every((v) => v === 0)) {
        throw new Error('Embedding provider returned an all-zero vector');
      }

      await this.db
        .update(knowledgeEntries)
        .set({
          ...embeddingSetPayload(dimensions, vec),
          status: 'indexed',
          lastError: null,
        })
        .where(eq(knowledgeEntries.id, entryId));

      this.logger.debug(`Entry ${entryId} embedded successfully`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to embed entry ${entryId}: ${message}`);
      await this.db
        .update(knowledgeEntries)
        .set({ status: 'failed', lastError: message })
        .where(eq(knowledgeEntries.id, entryId));
      // Re-throw so BullMQ retries the job with exponential backoff
      throw err;
    }
  }
}
