import { AIProviderType } from '../common/utils/config-types.js';
import type { EmbeddingBucket } from '@linea/ai';

export const RAG_EMBED_QUEUE = 'rag-embed';

export interface RagEmbedJobData {
  entryId: string;
  knowledgeBaseId: string;
  workspaceId: string;
  /** Raw chunk text to embed */
  content: string;
  /** SHA-256 hash of content — used to detect pre-existing embeddings */
  contentHash: string;
  /** Embedding model locked to the owning KB */
  embeddingModel: string;
  /** AI Provider */
  provider: AIProviderType;
  /** Owning KB's dimension bucket — selects the embedding column to write */
  dimensions: EmbeddingBucket;
}
