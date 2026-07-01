import type { ModelDefinition } from '../types';

export const GOOGLE: ModelDefinition[] = [
  {
    id: 'gemini-2.5-pro-preview-05-06',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    description:
      'Most capable Gemini. Unmatched 1M token context for massive documents.',
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
    badge: 'most-capable',
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    description:
      'Fast multimodal model with 1M context. Best value for vision + long docs.',
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
    description:
      'Lowest-cost Gemini. Use for simple classification and extraction tasks.',
    contextWindow: 1_048_576,
    maxOutputTokens: 8_192,
    tier: 'fast',
    useCases: ['fast-response', 'conversation'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 0.075, output: 0.3 },
    badge: 'best-value',
  },
];
