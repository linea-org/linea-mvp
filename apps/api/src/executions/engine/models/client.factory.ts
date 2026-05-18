import type { ModelProvider } from './registry';
import type { ToolDefinition } from '../tools/definitions';

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
}

export interface CompletionResult {
  text: string;
  toolCalls?: NormalizedToolCall[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop';
  usage: { inputTokens: number; outputTokens: number };
}

export type ModelApiKeys = {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  XAI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
};

export type ModelClient = (
  messages: ChatMessage[],
  opts?: CompletionOptions,
) => Promise<CompletionResult>;

export function createModelClient(
  modelId: string,
  provider: ModelProvider,
  apiKeys: ModelApiKeys,
): ModelClient {
  switch (provider) {
    case 'anthropic':
      return createAnthropicClient(modelId, apiKeys.ANTHROPIC_API_KEY);
    case 'openai':
      return createOpenAIClient(modelId, apiKeys.OPENAI_API_KEY);
    case 'xai':
      return createOpenAIClient(modelId, apiKeys.XAI_API_KEY, 'https://api.x.ai/v1');
    case 'groq':
      return createOpenAIClient(
        modelId,
        apiKeys.GROQ_API_KEY,
        'https://api.groq.com/openai/v1',
      );
    case 'google':
      return createGoogleClient(modelId, apiKeys.GOOGLE_API_KEY);
    case 'ollama':
      // Ollama uses the OpenAI-compatible API; no key required, 'ollama' satisfies the client check
      return createOpenAIClient(
        modelId,
        'ollama',
        apiKeys.OLLAMA_BASE_URL ?? 'http://localhost:11434/v1',
      );
    default:
      throw new Error(`Unsupported provider: ${String(provider)}`);
  }
}

// ─── Anthropic ────────────────────────────────────────────────────────────────

function createAnthropicClient(modelId: string, apiKey?: string): ModelClient {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');

  return async (messages, opts = {}) => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey });

    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    // Convert our normalized messages to Anthropic format
    const anthropicMsgs: any[] = chatMsgs.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId,
              content: m.content,
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        return { role: 'assistant' as const, content };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });

    const anthropicTools = opts.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const response = await client.messages.create({
      model: modelId,
      max_tokens: opts.maxTokens ?? 4096,
      ...(opts.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
      ...(systemMsg ? { system: systemMsg.content } : {}),
      messages: anthropicMsgs,
      ...(anthropicTools?.length ? { tools: anthropicTools } : {}),
      ...(opts.toolChoice && anthropicTools?.length
        ? {
            tool_choice:
              opts.toolChoice === 'required'
                ? { type: 'any' as const }
                : opts.toolChoice === 'auto'
                  ? { type: 'auto' as const }
                  : undefined,
          }
        : {}),
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text as string)
      .join('');

    const toolCalls: NormalizedToolCall[] = response.content
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({
        id: (b as any).id,
        name: (b as any).name,
        arguments: (b as any).input ?? {},
      }));

    const stopReason =
      response.stop_reason === 'tool_use'
        ? 'tool_use'
        : response.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end_turn';

    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  };
}

// ─── OpenAI / Groq ────────────────────────────────────────────────────────────

function createOpenAIClient(
  modelId: string,
  apiKey?: string,
  baseURL?: string,
): ModelClient {
  if (!apiKey) throw new Error(`API key not configured for model ${modelId}`);

  return async (messages, opts = {}) => {
    const OpenAI = (await import('openai')).default;
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

    const isReasoningModel = /^o[1-9]/.test(modelId);

    // Convert our normalized messages to OpenAI format
    const openAIMsgs: any[] = messages.map((m) => {
      if (m.role === 'tool') {
        return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant',
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments),
            },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const openAITools = opts.tools?.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    const response = await client.chat.completions.create(
      {
        model: modelId,
        messages: openAIMsgs,
        ...(isReasoningModel
          ? {}
          : {
              max_tokens: opts.maxTokens ?? 4096,
              temperature: opts.temperature ?? 0.7,
            }),
        ...(opts.jsonMode && !isReasoningModel
          ? { response_format: { type: 'json_object' } }
          : {}),
        ...(openAITools?.length ? { tools: openAITools } : {}),
        ...(opts.toolChoice && openAITools?.length
          ? {
              tool_choice:
                opts.toolChoice === 'auto'
                  ? 'auto'
                  : opts.toolChoice === 'required'
                    ? 'required'
                    : 'none',
            }
          : {}),
      },
      { signal: opts.signal },
    );

    const choice = response.choices[0];
    const text = choice.message.content ?? '';
    const toolCalls: NormalizedToolCall[] = (
      choice.message.tool_calls ?? []
    ).map((tc) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments || '{}'),
    }));

    const stopReason =
      choice.finish_reason === 'tool_calls'
        ? 'tool_use'
        : choice.finish_reason === 'length'
          ? 'max_tokens'
          : 'end_turn';

    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
    };
  };
}

// ─── Google Gemini ────────────────────────────────────────────────────────────

function createGoogleClient(modelId: string, apiKey?: string): ModelClient {
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not configured');

  return async (messages, opts = {}) => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai = new GoogleGenerativeAI(apiKey);

    const tools = opts.tools?.length
      ? [
          {
            functionDeclarations: opts.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.parameters as any,
            })),
          },
        ]
      : undefined;

    const model = genai.getGenerativeModel({
      model: modelId,
      ...(tools ? { tools } : {}),
    });

    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMsgs = messages.filter((m) => m.role !== 'system');

    const history = chatMsgs.slice(0, -1).map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'user' as const,
          parts: [
            {
              functionResponse: {
                name: m.toolCallId ?? '',
                response: JSON.parse(m.content || '{}'),
              },
            },
          ],
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'model' as const,
          parts: m.toolCalls.map((tc) => ({
            functionCall: { name: tc.name, args: tc.arguments },
          })),
        };
      }
      return {
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        parts: [{ text: m.content }],
      };
    });

    const lastMsg = chatMsgs[chatMsgs.length - 1]?.content ?? '';

    const chat = model.startChat({
      history,
      ...(systemMsg ? { systemInstruction: systemMsg.content } : {}),
      generationConfig: {
        maxOutputTokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });

    const result = await chat.sendMessage(lastMsg);
    const response = result.response;
    const text = response.text() || '';
    const usage = response.usageMetadata;

    const toolCalls: NormalizedToolCall[] = (
      response.functionCalls() ?? []
    ).map((fc, i) => ({
      id: `google_fc_${i}`,
      name: fc.name,
      arguments: fc.args as Record<string, any>,
    }));

    const stopReason = toolCalls.length ? 'tool_use' : 'end_turn';

    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      },
    };
  };
}
