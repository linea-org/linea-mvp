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

export type ModelProvider = 'anthropic' | 'openai' | 'xai' | 'groq' | 'google' | 'ollama';
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
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

const ANTHROPIC: ModelDefinition[] = [
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    description: 'Most powerful Claude model. Best for complex multi-step reasoning and coding.',
    contextWindow: 200_000,
    maxOutputTokens: 32_000,
    tier: 'powerful',
    useCases: ['general', 'coding', 'reasoning', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true, extendedThinking: true },
    costPer1mTokens: { input: 15, output: 75 },
    badge: 'most-capable',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description: 'Best all-around model. Ideal for agentic workflows, coding, and analysis.',
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision', 'data-extraction'],
    capabilities: { vision: true, functionCalling: true, streaming: true, extendedThinking: true },
    costPer1mTokens: { input: 3, output: 15 },
    badge: 'best-for-agents',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description: 'Fastest Claude model. Great for classification, extraction, and high-volume tasks.',
    contextWindow: 200_000,
    maxOutputTokens: 8_000,
    tier: 'fast',
    useCases: ['fast-response', 'conversation', 'data-extraction'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.8, output: 4 },
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet (legacy)',
    provider: 'anthropic',
    description: 'Previous generation Sonnet. Still excellent for coding and general tasks.',
    contextWindow: 200_000,
    maxOutputTokens: 8_096,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 3, output: 15 },
  },
];

// ─── OpenAI ───────────────────────────────────────────────────────────────────

const OPENAI: ModelDefinition[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    description: 'Flagship multimodal model. Excellent for vision tasks and general workflows.',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision', 'data-extraction'],
    capabilities: { vision: true, functionCalling: true, streaming: true, json: true },
    costPer1mTokens: { input: 2.5, output: 10 },
    badge: 'recommended',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    description: 'Ultra-affordable with vision. Best value for high-volume, simple tasks.',
    contextWindow: 128_000,
    maxOutputTokens: 16_384,
    tier: 'fast',
    useCases: ['fast-response', 'data-extraction', 'conversation'],
    capabilities: { vision: true, functionCalling: true, streaming: true, json: true },
    costPer1mTokens: { input: 0.15, output: 0.6 },
    badge: 'best-value',
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'openai',
    description: 'Optimized for long-context coding and instruction following.',
    contextWindow: 1_047_576,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['coding', 'long-context', 'general'],
    capabilities: { vision: true, functionCalling: true, streaming: true, json: true },
    costPer1mTokens: { input: 2, output: 8 },
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'openai',
    description: 'Fast reasoning model. Best for math, science, and multi-step logic.',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 1.1, output: 4.4 },
    badge: 'best-reasoning',
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'openai',
    description: 'Most powerful OpenAI reasoning model for frontier-level problems.',
    contextWindow: 200_000,
    maxOutputTokens: 100_000,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 10, output: 40 },
  },
];

// ─── xAI (Grok, OpenAI-compatible) ───────────────────────────────────────────

const XAI: ModelDefinition[] = [
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    description: 'xAI flagship model. Excels at coding, math, and real-world reasoning.',
    contextWindow: 131_072,
    maxOutputTokens: 131_072,
    tier: 'powerful',
    useCases: ['general', 'coding', 'reasoning'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 3, output: 15 },
    badge: 'recommended',
  },
  {
    id: 'grok-3-mini',
    name: 'Grok 3 Mini',
    provider: 'xai',
    description: 'Lightweight Grok with strong reasoning. Best value in the Grok family.',
    contextWindow: 131_072,
    maxOutputTokens: 131_072,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding', 'fast-response'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.3, output: 0.5 },
    badge: 'best-value',
  },
  {
    id: 'grok-2-1212',
    name: 'Grok 2',
    provider: 'xai',
    description: 'Previous generation Grok. Solid general-purpose model for most tasks.',
    contextWindow: 131_072,
    maxOutputTokens: 131_072,
    tier: 'balanced',
    useCases: ['general', 'coding', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 2, output: 10 },
  },
  {
    id: 'grok-2-vision-1212',
    name: 'Grok 2 Vision',
    provider: 'xai',
    description: 'Grok 2 with image understanding. For multimodal workflows.',
    contextWindow: 32_768,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['vision', 'general'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 2, output: 10 },
  },
];

// ─── Groq (OpenAI-compatible, ultra-fast inference) ──────────────────────────

const GROQ: ModelDefinition[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    description: 'Best Groq model for general tasks. Fast inference, open-source quality.',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['general', 'coding', 'fast-response'],
    capabilities: { vision: false, functionCalling: true, streaming: true, json: true },
    costPer1mTokens: { input: 0.59, output: 0.79 },
    badge: 'recommended',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    description: 'Blindingly fast for simple tasks. Lowest cost on the platform.',
    contextWindow: 128_000,
    maxOutputTokens: 8_000,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.05, output: 0.08 },
    badge: 'fastest',
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill 70B',
    provider: 'groq',
    description: 'Distilled reasoning model on Groq hardware. Exceptional math and logic.',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0.75, output: 0.99 },
    badge: 'best-reasoning',
  },
  {
    id: 'qwen-qwq-32b',
    name: 'Qwen QwQ 32B',
    provider: 'groq',
    description: 'Strong open-source reasoning model. Excellent at structured problem solving.',
    contextWindow: 128_000,
    maxOutputTokens: 32_768,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding', 'data-extraction'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.29, output: 0.39 },
  },
  {
    id: 'mixtral-8x7b-32768',
    name: 'Mixtral 8x7B',
    provider: 'groq',
    description: 'MoE model with strong multilingual and extraction capabilities.',
    contextWindow: 32_768,
    maxOutputTokens: 32_768,
    tier: 'balanced',
    useCases: ['general', 'data-extraction'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.24, output: 0.24 },
  },
];

// ─── Google Gemini ────────────────────────────────────────────────────────────

const GOOGLE: ModelDefinition[] = [
  {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description: 'Most capable Gemini. Unmatched 1M token context for massive documents.',
    contextWindow: 1_048_576,
    maxOutputTokens: 65_536,
    tier: 'powerful',
    useCases: ['reasoning', 'long-context', 'vision', 'coding'],
    capabilities: { vision: true, functionCalling: true, streaming: true, extendedThinking: true },
    costPer1mTokens: { input: 1.25, output: 10 },
    badge: 'most-capable',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description: 'Fast multimodal model with 1M context. Best value for vision + long docs.',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'general', 'vision', 'long-context'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.1, output: 0.4 },
    badge: 'recommended',
  },
  {
    id: 'gemini-2.0-flash-lite',
    name: 'Gemini 2.0 Flash Lite',
    provider: 'google',
    description: 'Lowest-cost Gemini. Use for simple classification and extraction tasks.',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.075, output: 0.3 },
    badge: 'best-value',
  },
];

// ─── Ollama (local, OpenAI-compatible) ───────────────────────────────────────

const OLLAMA: ModelDefinition[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2',
    provider: 'ollama',
    description: 'Meta\'s latest small model. Good all-rounder for local inference.',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'fast-response', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'qwen2.5',
    name: 'Qwen 2.5',
    provider: 'ollama',
    description: 'Alibaba\'s versatile model. Excellent coding and multilingual support.',
    contextWindow: 128_000,
    maxOutputTokens: 4_096,
    tier: 'balanced',
    useCases: ['general', 'coding'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
    badge: 'recommended',
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'ollama',
    description: 'Open-source reasoning model. Competitive with frontier models on math.',
    contextWindow: 64_000,
    maxOutputTokens: 8_192,
    tier: 'reasoning',
    useCases: ['reasoning', 'coding'],
    capabilities: { vision: false, functionCalling: false, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
  {
    id: 'mistral',
    name: 'Mistral 7B',
    provider: 'ollama',
    description: 'Efficient 7B model. Great for fast local inference with tool use.',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
];

// ─── Embedding models ─────────────────────────────────────────────────────────

const EMBEDDING: ModelDefinition[] = [
  // OpenAI
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    provider: 'openai',
    description: 'Fast, affordable embedding model. 1536 dimensions. Best for most RAG use cases.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 1536,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0.02, output: 0 },
    badge: 'recommended',
  },
  {
    id: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    provider: 'openai',
    description: 'Higher-quality embeddings. 3072 dimensions. Use when retrieval accuracy matters most.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 3072,
    tier: 'balanced',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0.13, output: 0 },
  },
  {
    id: 'text-embedding-ada-002',
    name: 'text-embedding-ada-002',
    provider: 'openai',
    description: 'Legacy OpenAI embedding model. 1536 dimensions. Use if you have existing indexed data.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 1536,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0.1, output: 0 },
  },
  // Google
  {
    id: 'text-embedding-004',
    name: 'text-embedding-004',
    provider: 'google',
    description: 'Google\'s latest embedding model. 768 dimensions. Optimized for semantic similarity.',
    contextWindow: 2_048,
    maxOutputTokens: 0,
    dimensions: 768,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0, output: 0 },
    badge: 'best-value',
  },
  // Ollama (local)
  {
    id: 'nomic-embed-text',
    name: 'nomic-embed-text',
    provider: 'ollama',
    description: 'Best local embedding model. 768 dimensions. No API key required.',
    contextWindow: 8_192,
    maxOutputTokens: 0,
    dimensions: 768,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0, output: 0 },
    badge: 'recommended',
  },
  {
    id: 'mxbai-embed-large',
    name: 'mxbai-embed-large',
    provider: 'ollama',
    description: 'High-quality local embeddings. 1024 dimensions. Strong multilingual support.',
    contextWindow: 512,
    maxOutputTokens: 0,
    dimensions: 1024,
    tier: 'balanced',
    useCases: ['embedding'],
    capabilities: { vision: false, functionCalling: false, streaming: false, embedding: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
];

// ─── Registry ─────────────────────────────────────────────────────────────────

export const MODEL_REGISTRY: Record<string, ModelDefinition> =
  Object.fromEntries(
    [...ANTHROPIC, ...OPENAI, ...XAI, ...GROQ, ...GOOGLE, ...OLLAMA, ...EMBEDDING].map((m) => [m.id, m]),
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
    xai: 'XAI_API_KEY',
    groq: 'GROQ_API_KEY',
    google: 'GOOGLE_API_KEY',
  };
  return Boolean(keys[map[provider]]);
}
