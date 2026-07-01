import type { ModelDefinition } from '../types';

export const ANTHROPIC: ModelDefinition[] = [
  {
    id: 'claude-opus-4-7',
    name: 'Claude Opus 4.7',
    provider: 'anthropic',
    description:
      'Most powerful Claude model. Best for complex multi-step reasoning and coding.',
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
    badge: 'most-capable',
  },
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    description:
      'Best all-around model. Ideal for agentic workflows, coding, and analysis.',
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
    badge: 'best-for-agents',
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    description:
      'Fastest Claude model. Great for classification, extraction, and high-volume tasks.',
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
    description:
      'Previous generation Sonnet. Still excellent for coding and general tasks.',
    contextWindow: 200_000,
    maxOutputTokens: 8_096,
    tier: 'balanced',
    useCases: ['general', 'coding', 'vision'],
    capabilities: { vision: true, functionCalling: true, streaming: true },
    costPer1mTokens: { input: 3, output: 15 },
  },
];
