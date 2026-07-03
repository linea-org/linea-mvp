import { AIProviderType } from '../common/utils/config-types';

export const RAG_EMBED_QUEUE = 'rag-embed';

export interface RagEmbedJobData {
  entryId: string;
  knowledgeBaseId: string;
  workspaceId: string;
  /** Raw chunk text to embed */
  content: string;
  /** SHA-256 hash of content — used to detect pre-existing embeddings */
  contentHash: string;
  /** Embedding model to use (OpenAI 1536d models only) */
  embeddingModel: string;
  /** AI Provider */
  provider: AIProviderType;
}
