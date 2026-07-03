// Model Registry
//
// Add, remove, or update entries here whenever a provider ships a new model.
// Provider model lists live in ./providers/<provider>.ts — no other changes needed
// for a new model; add a new provider file and wire it in below for a new provider.

import type { ModelDefinition, ModelTier } from './types';
import { ANTHROPIC } from './providers/anthropic';
import { OPENAI } from './providers/openai';
import { XAI } from './providers/xai';
import { GROQ } from './providers/groq';
import { GOOGLE } from './providers/google';
import { OLLAMA } from './providers/ollama';
import { EMBEDDING } from './providers/embedding';

export type {
  ModelProvider,
  ModelTier,
  ModelUseCase,
  ModelBadge,
  ModelStatus,
  ModelDefinition,
} from './types';

/**
 * All chat / completion models (no embedding models).
 * Use this when listing models for agent nodes, fallback chains, etc.
 * Excludes deprecated models.
 */
export const MODEL_REGISTRY: Record<string, ModelDefinition> =
  Object.fromEntries(
    [...ANTHROPIC, ...OPENAI, ...XAI, ...GROQ, ...GOOGLE, ...OLLAMA]
      .filter((m) => m.status !== 'deprecated')
      .map((m) => [m.id, m]),
  );

/**
 * Combined lookup across chat + embedding models.
 * Use for resolving any model ID the system may encounter (node config, secrets, etc.).
 */
const ALL_MODELS_REGISTRY: Record<string, ModelDefinition> =
  Object.fromEntries(
    [
      ...ANTHROPIC,
      ...OPENAI,
      ...XAI,
      ...GROQ,
      ...GOOGLE,
      ...OLLAMA,
      ...EMBEDDING,
    ].map((m) => [m.id, m]),
  );

export function getModelOrDefault(
  id: string | undefined,
  tier: ModelTier = 'balanced',
): ModelDefinition {
  if (id && ALL_MODELS_REGISTRY[id]) return ALL_MODELS_REGISTRY[id];
  // Fall back to cheapest available for the requested tier
  const fallbacks: Record<ModelTier, string> = {
    fast: 'claude-haiku-4-5',
    balanced: 'claude-sonnet-4-6',
    powerful: 'claude-opus-4-7',
    reasoning: 'o4-mini',
  };
  return MODEL_REGISTRY[fallbacks[tier]] ?? MODEL_REGISTRY['claude-sonnet-4-6'];
}
