// Model Registry
//
// Add, remove, or update entries here whenever a provider ships a new model.
// The rest of the system reads this file — no other changes needed.
//
// Fields:
//   id              - exact string sent to the provider API
//   name            - human-readable label shown in the UI
//   provider        - which SDK/client to use
//   contextWindow   - input context limit (tokens)
//   maxOutputTokens - max generation length
//   tier            - 'fast' | 'balanced' | 'powerful' | 'reasoning'
//   capabilities    - what the model supports
//   costPer1mTokens - approximate USD cost (helps the supervisor pick cheap models)

export type ModelProvider =
  | 'anthropic'
  | 'openai'
  | 'xai'
  | 'groq'
  | 'google'
  | 'ollama';
export type ModelTier = 'fast' | 'balanced' | 'powerful' | 'reasoning';
export type ModelUseCase =
  | 'general'
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'long-context'
  | 'conversation'
  | 'data-extraction'
  | 'fast-response'
  | 'embedding';
export type ModelBadge =
  | 'recommended'
  | 'best-for-agents'
  | 'best-reasoning'
  | 'best-value'
  | 'fastest'
  | 'most-capable';

/**
 * Lifecycle status:
 *   production — stable, supported, safe for all users
 *   preview    — available now but may change/disappear; safe for experimentation
 *   deprecated — will be removed; users should migrate away
 */
export type ModelStatus = 'production' | 'preview' | 'deprecated';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  tier: ModelTier;
  useCases: ModelUseCase[];
  capabilities: {
    vision: boolean;
    functionCalling: boolean;
    streaming: boolean;
    extendedThinking?: boolean;
    json?: boolean;
    embedding?: boolean;
  };
  /** Embedding output dimensions — only set for embedding models */
  dimensions?: number;
  costPer1mTokens: { input: number; output: number };
  badge?: ModelBadge;
  /** Lifecycle status. Defaults to 'production' when omitted. */
  status?: ModelStatus;
}
