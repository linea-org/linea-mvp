import type { ModelDefinition } from '../types';

// Updated 2026-05-25 based on official Groq production model list.
// Preview models are included but flagged status:'preview'.
// Deprecated models removed: deepseek-r1-distill-llama-70b, qwen-qwq-32b, mixtral-8x7b-32768.

export const GROQ: ModelDefinition[] = [
  {
    id: 'llama-3.3-70b-versatile',
    name: 'Llama 3.3 70B',
    provider: 'groq',
    description:
      'Best Groq model for agentic and general tasks. 280 T/s, 131K context.',
    contextWindow: 131_072,
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
    badge: 'recommended',
    status: 'production',
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    description:
      'Fastest Groq model — 560 T/s. Lowest cost for high-volume simple tasks.',
    contextWindow: 131_072,
    maxOutputTokens: 131_072,
    tier: 'fast',
    useCases: ['fast-response', 'conversation', 'data-extraction'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.05, output: 0.08 },
    badge: 'fastest',
    status: 'production',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT OSS 120B (Groq)',
    provider: 'groq',
    description:
      'OpenAI open-source 120B on Groq hardware. 500 T/s, 65K output.',
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    tier: 'powerful',
    useCases: ['general', 'coding', 'reasoning', 'long-context'],
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 0.15, output: 0.6 },
    status: 'production',
  },
  {
    id: 'openai/gpt-oss-20b',
    name: 'GPT OSS 20B (Groq)',
    provider: 'groq',
    description:
      'OpenAI open-source 20B on Groq hardware. 1000 T/s — fastest large model.',
    contextWindow: 131_072,
    maxOutputTokens: 65_536,
    tier: 'fast',
    useCases: ['fast-response', 'general', 'data-extraction'],
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 0.075, output: 0.3 },
    badge: 'best-value',
    status: 'production',
  },
  {
    id: 'groq/compound',
    name: 'Groq Compound',
    provider: 'groq',
    description:
      'Groq agentic system with built-in web search and code execution. 450 T/s.',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    tier: 'balanced',
    useCases: ['general', 'reasoning', 'coding'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 }, // pricing TBD
    status: 'production',
  },
  {
    id: 'groq/compound-mini',
    name: 'Groq Compound Mini',
    provider: 'groq',
    description:
      'Smaller Groq compound system. Fast + agentic for lighter workloads.',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'general'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 }, // pricing TBD
    status: 'production',
  },
  {
    id: 'meta-llama/llama-4-scout-17b-16e-instruct',
    name: 'Llama 4 Scout 17B',
    provider: 'groq',
    description:
      'Meta Llama 4 Scout on Groq. 750 T/s, multimodal (vision). Preview.',
    contextWindow: 131_072,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'general', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.11, output: 0.34 },
    status: 'preview',
  },
  {
    id: 'qwen/qwen3-32b',
    name: 'Qwen 3 32B',
    provider: 'groq',
    description:
      'Alibaba Qwen3 32B on Groq. 400 T/s, strong coding and multilingual. Preview.',
    contextWindow: 131_072,
    maxOutputTokens: 40_960,
    tier: 'balanced',
    useCases: ['reasoning', 'coding', 'data-extraction', 'general'],
    capabilities: {
      vision: false,
      functionCalling: true,
      streaming: true,
      json: true,
    },
    costPer1mTokens: { input: 0.29, output: 0.59 },
    badge: 'best-reasoning',
    status: 'preview',
  },
];
