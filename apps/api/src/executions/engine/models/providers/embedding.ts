import type { ModelDefinition } from '../types';

export const EMBEDDING: ModelDefinition[] = [
  // OpenAI
  {
    id: 'text-embedding-3-small',
    name: 'text-embedding-3-small',
    provider: 'openai',
    description:
      'Fast, affordable embedding model. 1536 dimensions. Best for most RAG use cases.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 1536,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0.02, output: 0 },
    badge: 'recommended',
  },
  {
    id: 'text-embedding-3-large',
    name: 'text-embedding-3-large',
    provider: 'openai',
    description:
      'Higher-quality embeddings. 3072 dimensions. Use when retrieval accuracy matters most.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 3072,
    tier: 'balanced',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0.13, output: 0 },
  },
  {
    id: 'text-embedding-ada-002',
    name: 'text-embedding-ada-002',
    provider: 'openai',
    description:
      'Legacy OpenAI embedding model. 1536 dimensions. Use if you have existing indexed data.',
    contextWindow: 8_191,
    maxOutputTokens: 0,
    dimensions: 1536,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0.1, output: 0 },
  },
  // Google
  {
    id: 'text-embedding-004',
    name: 'text-embedding-004',
    provider: 'google',
    description:
      "Google's latest embedding model. 768 dimensions. Optimized for semantic similarity.",
    contextWindow: 2_048,
    maxOutputTokens: 0,
    dimensions: 768,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0, output: 0 },
    badge: 'best-value',
  },
  // Ollama (local)
  {
    id: 'nomic-embed-text',
    name: 'nomic-embed-text',
    provider: 'ollama',
    description:
      'Best local embedding model. 768 dimensions. No API key required.',
    contextWindow: 8_192,
    maxOutputTokens: 0,
    dimensions: 768,
    tier: 'fast',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0, output: 0 },
    badge: 'recommended',
  },
  {
    id: 'mxbai-embed-large',
    name: 'mxbai-embed-large',
    provider: 'ollama',
    description:
      'High-quality local embeddings. 1024 dimensions. Strong multilingual support.',
    contextWindow: 512,
    maxOutputTokens: 0,
    dimensions: 1024,
    tier: 'balanced',
    useCases: ['embedding'],
    capabilities: {
      vision: false,
      functionCalling: false,
      streaming: false,
      embedding: true,
    },
    costPer1mTokens: { input: 0, output: 0 },
  },
];
