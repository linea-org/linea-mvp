import type { ModelProvider } from "@linea/types"

// 3072 deferred: pgvector caps hnsw/ivfflat indexes at 2000 dimensions
export type EmbeddingBucket = 768 | 1536

const SUPPORTED_BUCKETS: EmbeddingBucket[] = [768, 1536]

export interface EmbeddingModelInfo {
  id: string
  provider: ModelProvider
  dimensions: number
}

/** Embedding model id, provider, and native output dimension — anthropic/groq have none. */
export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  { id: "text-embedding-3-small", provider: "openai", dimensions: 1536 },
  { id: "text-embedding-3-large", provider: "openai", dimensions: 3072 },
  { id: "text-embedding-ada-002", provider: "openai", dimensions: 1536 },
  { id: "gemini-embedding-001", provider: "google", dimensions: 3072 },
  { id: "text-embedding-005", provider: "google", dimensions: 768 },
  {
    id: "text-multilingual-embedding-002",
    provider: "google",
    dimensions: 768,
  },
  { id: "nomic-embed-text", provider: "ollama", dimensions: 768 },
  { id: "mxbai-embed-large", provider: "ollama", dimensions: 1024 },
]

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-005"
export const DEFAULT_EMBEDDING_PROVIDER: ModelProvider = "google"

/** Resolves an embedding model id to its provider and dimension bucket; throws otherwise. */
export function resolveEmbeddingBucket(modelId: string): {
  provider: ModelProvider
  dimensions: number
  bucket: EmbeddingBucket
} {
  const model = EMBEDDING_MODELS.find((m) => m.id === modelId)
  if (!model) {
    throw new Error(`Unknown embedding model: ${modelId}`)
  }
  const bucket = SUPPORTED_BUCKETS.find((b) => b === model.dimensions)
  if (!bucket) {
    throw new Error(
      `Embedding model '${modelId}' has unsupported dimension ${model.dimensions} (supported: ${SUPPORTED_BUCKETS.join(", ")})`
    )
  }
  return { provider: model.provider, dimensions: model.dimensions, bucket }
}
