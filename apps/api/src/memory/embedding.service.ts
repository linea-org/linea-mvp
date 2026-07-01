import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// pgvector column dimensions for knowledgeEntries and memories tables
export const EMBEDDING_DIMENSIONS = 1536;

// Models that support the OpenAI `dimensions` reduction parameter
const SUPPORTS_DIMENSION_PARAM = new Set([
  'text-embedding-3-small',
  'text-embedding-3-large',
]);

/**
 * @deprecated use [AIService]
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly defaultApiKey: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.defaultApiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!this.defaultApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set — using zero-vector fallback for embeddings',
      );
    }
  }

  /**
   * Generate a 1536-dimensional embedding for `text`.
   * @param modelId  - The embedding model to use (from MODEL_REGISTRY).
   *                   Must be an OpenAI model whose dimensions can be normalised to 1536.
   *                   Google/Ollama models output different dimensions (768/1024d) that do
   *                   not match the pgvector schema; they return a zero-vector and callers
   *                   should fall back to text search.
   * @param apiKeyOverride - Workspace-level BYOK key; falls back to system OPENAI_API_KEY.
   */
  async embed(
    text: string,
    modelId = 'text-embedding-3-small',
    apiKeyOverride?: string,
  ): Promise<number[]> {
    const key = apiKeyOverride ?? this.defaultApiKey;

    // Determine provider from model id prefix / well-known names.
    // Ollama models output non-1536d vectors — fall back to keyword search.
    const isOllama =
      modelId === 'nomic-embed-text' ||
      modelId === 'mxbai-embed-large' ||
      (!modelId.startsWith('text-embedding') && !modelId.startsWith('ada-'));
    const isGoogle = modelId === 'text-embedding-004';

    if (isGoogle || isOllama) {
      this.logger.warn(
        `Embedding model ${modelId} outputs dimensions that do not match the 1536d pgvector schema — ` +
          `vector search is unavailable; the retriever will fall back to keyword search.`,
      );
      return new Array(EMBEDDING_DIMENSIONS).fill(0);
    }

    if (!key) return new Array(EMBEDDING_DIMENSIONS).fill(0);

    try {
      const body: Record<string, unknown> = { model: modelId, input: text };
      // Only new -3-* models support the dimensions parameter
      if (SUPPORTS_DIMENSION_PARAM.has(modelId))
        body['dimensions'] = EMBEDDING_DIMENSIONS;

      const resp = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      const json = (await resp.json()) as {
        data?: [{ embedding: number[] }];
        error?: { message: string };
      };
      if (!resp.ok || !json.data?.[0]) {
        this.logger.warn(
          `Embedding API error: ${json.error?.message ?? resp.status}`,
        );
        return new Array(EMBEDDING_DIMENSIONS).fill(0);
      }
      return json.data[0].embedding;
    } catch (err) {
      this.logger.error('Embedding failed, using zero-vector fallback', err);
      return new Array(EMBEDDING_DIMENSIONS).fill(0);
    }
  }

  toVectorString(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
