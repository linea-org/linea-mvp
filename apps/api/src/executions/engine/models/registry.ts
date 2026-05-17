// ─────────────────────────────────────────────────────────────────────────────
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
// ─────────────────────────────────────────────────────────────────────────────

export type ModelProvider = 'anthropic' | 'openai' | 'groq' | 'google' | 'ollama';
export type ModelTier = 'fast' | 'balanced' | 'powerful' | 'reasoning';
export type ModelUseCase =
  | 'general'
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'long-context'
  | 'conversation'
  | 'data-extraction'
  | 'fast-response';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: ModelProvider;
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
  };
  costPer1mTokens: { input: number; output: number };
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

const ANTHROPIC: ModelDefinition[] = [
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    tier: 'powerful',
    useCases: ['general', 'coding', 'reasoning', 'vision'],
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      extendedThinking: true,
    },
    costPer1mTokens: { input: 15, output: 75 },
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision', 'data-extraction'],
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      extendedThinking: true,
    },
    costPer1mTokens: { input: 3, output: 15 },
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 8_000,
    tier: 'fast',
    useCases: ['fast-response', 'conversation', 'data-extraction'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.8, output: 4 },
  },
  // Legacy — still widely used
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 8_096,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 3, output: 15 },
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200_000,
    maxOutputTokens: 8_096,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.8, output: 4 },
  },
];

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI: ModelDefinition[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision', 'data-extraction'],
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 2.5, output: 10 },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tier: 'fast',
    useCases: ['fast-response', 'data-extraction', 'conversation'],
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 0.15, output: 0.6 },
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini (Reasoning)',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 1.1, output: 4.4 },
  },
  {
    id: 'o3',
    name: 'o3 (Reasoning)',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 10, output: 40 },
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini (Reasoning)',
    provider: 'openai',
    contextWindow: 200_000,
    maxOutputTokens: 65_536,
    tier: 'reasoning',
    useCases: ['reasoning'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 1.1, output: 4.4 },
  },
];

// ─── Groq (OpenAI-compatible, ultra-fast inference) ──────────────────────────

const GROQ: ModelDefinition[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B (Groq)',
    provider: 'groq',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['general', 'coding', 'fast-response'],
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 0.59, output: 0.79 },
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant (Groq)',
    provider: 'groq',
    contextWindow: 128_000,
    maxOutputTokens: 8_000,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.05, output: 0.08 },
  },
  {
    id: 'llama3-70b-8192',
    name: 'Llama 3 70B (Groq)',
    provider: 'groq',
    contextWindow: 8_192,
    maxOutputTokens: 8_192,
    tier: 'balanced',
    useCases: ['general'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0.59, output: 0.79 },
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B (Groq)',
    provider: 'groq',
    contextWindow: 32_768,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['general', 'data-extraction'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.24, output: 0.24 },
  },
  {
    id: 'gemma2-9b-it',
    name: 'Gemma 2 9B (Groq)',
    provider: 'groq',
    contextWindow: 8_192,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0.2, output: 0.2 },
  },
];

// ─── Google Gemini ────────────────────────────────────────────────────────────

const GOOGLE: ModelDefinition[] = [
  {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro Preview',
    provider: 'google',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    tier: 'powerful',
    useCases: ['reasoning', 'long-context', 'vision', 'coding'],
    capabilities: {
      vision: true,
      functionCalling: true,
      streaming: true,
      extendedThinking: true,
    },
    costPer1mTokens: { input: 1.25, output: 10 },
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'general', 'vision', 'long-context'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.1, output: 0.4 },
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.075, output: 0.3 },
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'google',
    contextWindow: 2_097_152,
    maxOutputTokens: 8_192,
    tier: 'balanced',
    useCases: ['long-context', 'vision', 'general'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 1.25, output: 5 },
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'google',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'long-context', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.075, output: 0.3 },
  },
];

// ─── Ollama (local, OpenAI-compatible) ───────────────────────────────────────

const OLLAMA: ModelDefinition[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2 (Ollama)',
    provider: 'ollama',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'llama3.1',
    name: 'Llama 3.1 8B (Ollama)',
    provider: 'ollama',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'fast-response'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'mistral',
    name: 'Mistral 7B (Ollama)',
    provider: 'ollama',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'qwen2.5',
    name: 'Qwen 2.5 (Ollama)',
    provider: 'ollama',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'balanced',
    useCases: ['general', 'coding'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'phi3',
    name: 'Phi-3 Mini (Ollama)',
    provider: 'ollama',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1 (Ollama)',
    provider: 'ollama',
    contextWindow: 64_000,
    maxOutputTokens: 8_192,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelDefinition> =
  Object.fromEntries(
    [...ANTHROPIC, ...OPENAI, ...GROQ, ...GOOGLE, ...OLLAMA].map((m) => [m.id, m]),
  );

export function getModel(id: string): ModelDefinition {
  const model = MODEL_REGISTRY[id];
  if (!model)
    throw new Error(
      `Unknown model '${id}'. Add it to apps/api/src/executions/engine/models/registry.ts`,
    );
  return model;
}

export function getModelOrDefault(
  id: string | undefined,
  tier: ModelTier = 'balanced',
): ModelDefinition {
  if (id && MODEL_REGISTRY[id]) return MODEL_REGISTRY[id];
  // Fall back to cheapest available for the requested tier
  const fallbacks: Record<ModelTier, string> = {
    fast: 'claude-haiku-4-5',
    balanced: 'claude-sonnet-4-6',
    powerful: 'claude-opus-4-7',
    reasoning: 'o4-mini',
  };
  return MODEL_REGISTRY[fallbacks[tier]] ?? MODEL_REGISTRY['claude-sonnet-4-6'];
}

/** All models for a given provider, sorted cheapest-first */
export function modelsByProvider(provider: ModelProvider): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.provider === provider)
    .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);
}

/** All models that support a given use case, sorted cheapest-first */
export function modelsByUseCase(useCase: ModelUseCase): ModelDefinition[] {
  return Object.values(MODEL_REGISTRY)
    .filter((m) => m.useCases.includes(useCase))
    .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);
}

/** Cheapest model across all providers that has the required capability */
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

function hasKeyFor(
  provider: ModelProvider,
  keys: Record<string, string | undefined>,
): boolean {
  if (provider === 'ollama') return true; // local, no API key required
  const map: Record<Exclude<ModelProvider, 'ollama'>, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    groq: 'GROQ_API_KEY',
    google: 'GOOGLE_API_KEY',
  };
  return Boolean(keys[map[provider]]);
}
