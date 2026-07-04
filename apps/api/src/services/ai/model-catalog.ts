import { AnthropicClient } from './clients/anthropic.client';
import { OpenAIClient } from './clients/openai.client';
import { GroqClient } from './clients/groq.client';
import { GoogleClient } from './clients/google.client';
import { XAIClient } from './clients/xai.client';
import { OllamaClient } from './clients/ollama.client';
import type { ModelDefinition } from './clients/interface';
import type { ModelProvider, ModelTier } from './types';

export type {
  ModelProvider,
  ModelTier,
  ModelUseCase,
  ModelBadge,
  ModelStatus,
} from './types';
export type { ModelDefinition } from './clients/interface';

export const AI_MODEL_CATALOG: ModelDefinition[] = [
  ...AnthropicClient.displayModels,
  ...OpenAIClient.displayModels,
  ...GroqClient.displayModels,
  ...GoogleClient.displayModels,
  ...XAIClient.displayModels,
  ...OllamaClient.displayModels,
];

export const AI_EMBEDDING_MODELS: { id: string; provider: ModelProvider }[] = [
  ...AnthropicClient.embeddingModels.map((id) => ({
    id,
    provider: 'anthropic' as const,
  })),
  ...OpenAIClient.embeddingModels.map((id) => ({
    id,
    provider: 'openai' as const,
  })),
  ...GroqClient.embeddingModels.map((id) => ({
    id,
    provider: 'groq' as const,
  })),
  ...GoogleClient.embeddingModels.map((id) => ({
    id,
    provider: 'google' as const,
  })),
  ...XAIClient.embeddingModels.map((id) => ({ id, provider: 'xai' as const })),
  ...OllamaClient.embeddingModels.map((id) => ({
    id,
    provider: 'ollama' as const,
  })),
];

const TIER_FALLBACK: Record<ModelTier, string> = {
  fast: 'claude-haiku-4-5',
  balanced: 'claude-sonnet-4-6',
  powerful: 'claude-opus-4-7',
  reasoning: 'o4-mini',
};

export function getModelOrDefault(
  id: string | undefined,
  tier: ModelTier = 'balanced',
): ModelDefinition {
  const found = id && AI_MODEL_CATALOG.find((m) => m.id === id);
  if (found) return found;

  const fallbackId = TIER_FALLBACK[tier];
  const fallback = AI_MODEL_CATALOG.find((m) => m.id === fallbackId);
  if (fallback) return fallback;

  const defaultModel = AI_MODEL_CATALOG.find(
    (m) => m.id === 'claude-sonnet-4-6',
  );
  if (!defaultModel) {
    throw new Error('No default model available in AI_MODEL_CATALOG');
  }
  return defaultModel;
}
