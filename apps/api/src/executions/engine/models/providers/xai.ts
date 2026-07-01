import type { ModelDefinition } from '../types';

export const XAI: ModelDefinition[] = [
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    description:
      'xAI flagship model. Excels at coding, math, and real-world reasoning.',
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
    description:
      'Lightweight Grok with strong reasoning. Best value in the Grok family.',
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
    description:
      'Previous generation Grok. Solid general-purpose model for most tasks.',
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
