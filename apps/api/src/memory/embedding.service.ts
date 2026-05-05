import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DIMENSIONS = 1536;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!this.apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — using zero-vector fallback for embeddings');
    }
  }

  async embed(text: string): Promise<number[]> {
    if (!this.apiKey) return new Array(DIMENSIONS).fill(0);

    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey: this.apiKey });
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        dimensions: DIMENSIONS,
      });
      return response.data[0].embedding;
    } catch (err) {
      this.logger.error('Embedding failed, using zero-vector fallback', err);
      return new Array(DIMENSIONS).fill(0);
    }
  }

  toVectorString(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
