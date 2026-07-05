import { ToolDefinition } from '../../../executions/engine/tools/definitions.js';
import {
  ChatMessage,
  CompletionResult,
  ModelBadge,
  ModelProvider,
  ModelStatus,
  ModelTier,
  ModelUseCase,
} from '../types.js';

export interface ModelChatProps {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  toolChoice?: 'auto' | 'required';
  maxTokens?: number;
  system?: string;
  jsonMode?: boolean;
  onToken?: (delta: string) => void;
  opts?: any;
}

export interface ModelClient {
  models: string[];
  embeddingModels: string[];
  displayModels: ModelDefinition[];
  chat(model: string, options: ModelChatProps): Promise<CompletionResult>;
  embedding(model: string, text: string): Promise<number[] | null>;
}

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
