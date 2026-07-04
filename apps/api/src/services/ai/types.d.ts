export type ModelProvider = Extract<
  ProviderType,
  'anthropic' | 'openai' | 'groq' | 'google' | 'ollama' | 'xai'
>;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string; // for role=tool: which call this result belongs to
  toolCalls?: NormalizedToolCall[]; // for role=assistant: tool calls the model made
}

export interface NormalizedToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface CompletionOptions {
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
  /** Called with each text token as it streams. When provided, clients use their streaming API. */
  onToken?: (delta: string) => void;
}

export type ModelStatus = 'production' | 'preview' | 'deprecated';

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

export interface CompletionResult {
  text: string;
  toolCalls?: NormalizedToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop';
  usage: { inputTokens: number; outputTokens: number };
}
