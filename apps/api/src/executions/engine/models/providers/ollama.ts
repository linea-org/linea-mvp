import type { ModelDefinition } from '../types';

export const OLLAMA: ModelDefinition[] = [
  {
    id: 'llama3.2',
    name: 'Llama 3.2',
    provider: 'ollama',
    description:
      "Meta's latest small model. Good all-rounder for local inference.",
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
    description:
      "Alibaba's versatile model. Excellent coding and multilingual support.",
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
    description:
      'Open-source reasoning model. Competitive with frontier models on math.',
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
    description:
      'Efficient 7B model. Great for fast local inference with tool use.',
    contextWindow: 8_192,
    maxOutputTokens: 4_096,
    tier: 'fast',
    useCases: ['general', 'conversation'],
    capabilities: { vision: false, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0, output: 0 },
  },
];
