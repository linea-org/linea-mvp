// Model Registry
//
// Add, remove, or update entries here whenever a provider ships a new model.
// Provider model lists live in ./providers/<provider>.ts — no other changes needed
// for a new model; add a new provider file and wire it in below for a new provider.

import type {
  ModelDefinition,
  ModelProvider,
  ModelTier,
  ModelUseCase,
} from './types';
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

export const EMBEDDING_REGISTRY: Record<string, ModelDefinition> =
  Object.fromEntries(EMBEDDING.map((m) => [m.id, m]));

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
export const ALL_MODELS_REGISTRY: Record<string, ModelDefinition> =
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

/** Resolve any model ID — looks in chat + embedding registries. */
export function getModel(id: string): ModelDefinition {
  const model = ALL_MODELS_REGISTRY[id];
  if (!model)
    throw new Error(
      `Unknown model '${id}'. Add it to apps/api/src/executions/engine/models/providers/`,
    );
  return model;
}

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

/** All chat models for a given provider, sorted cheapest-first. */
export function modelsByProvider(provider: ModelProvider): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.provider === provider)
    .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);
}

/** All models that support a given use case, sorted cheapest-first. */
export function modelsByUseCase(useCase: ModelUseCase): ModelDefinition[] {
  return Object.values(
    useCase === 'embedding' ? EMBEDDING_REGISTRY : MODEL_REGISTRY,
  )
    .filter((m) => m.useCases.includes(useCase))
    .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);
}

/** Cheapest chat model across all providers that has the required capability. */
export function cheapestModelWith(
  capability: keyof ModelDefinition['capabilities'],
  apiKeys: Record<string, string | undefined>,
): ModelDefinition {
  const available = Object.values(MODEL_REGISTRY)
    .filter((m) => m.capabilities[capability] && hasKeyFor(m.provider, apiKeys))
    .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);

  if (!available.length)
    throw new Error(`No available model with capability '${capability}'`);
  return available[0];
}

/** All production-status chat models — safe for surfacing to end users as primary choices. */
export function productionChatModels(): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY).filter(
    (m) => !m.status || m.status === 'production',
  );
}

/** All available embedding models across all providers. */
export function embeddingModels(): ModelDefinition[] {
  return Object.values(EMBEDDING_REGISTRY);
}

function hasKeyFor(
  provider: ModelProvider,
  keys: Record<string, string | undefined>,
): boolean {
  if (provider === 'ollama') return true; // local, no API key required
  const map: Record<Exclude<ModelProvider, 'ollama'>, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    xai: 'XAI_API_KEY',
    groq: 'GROQ_API_KEY',
    google: 'GOOGLE_API_KEY',
  };
  return Boolean(keys[map[provider]]);
}
