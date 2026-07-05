import {
  EnhancedGenerateContentResponse,
  FunctionCallingMode,
  GoogleGenerativeAI,
  TaskType,
} from '@google/generative-ai';
import { CompletionResult, NormalizedToolCall } from '../types.js';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface.js';
import { withRetry } from '../helpers.js';

export class GoogleClient implements ModelClient {
  static readonly displayModels: ModelDefinition[] = [
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

  static readonly embeddingModels: string[] = [
    'gemini-embedding-001',
    'text-embedding-005',
    'text-multilingual-embedding-002',
  ];

  displayModels: ModelDefinition[] = GoogleClient.displayModels;
  models: string[] = GoogleClient.displayModels.map((m) => m.id);
  embeddingModels: string[] = GoogleClient.embeddingModels;

  private _client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this._client = new GoogleGenerativeAI(apiKey);
  }

  async chat(
    model: string,
    {
      messages,
      jsonMode,
      maxTokens,
      onToken,
      system,
      temperature,
      toolChoice,
      tools,
    }: ModelChatProps,
  ): Promise<CompletionResult> {
    if (!this.models.includes(model)) {
      throw new Error(`Google Gemini does not support this model: ${model}`);
    }
    const systemMsg =
      messages.find((m) => m.role === 'system')?.content || system;
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

    const genModel = this._client.getGenerativeModel({
      model,
      tools: tools?.length
        ? [
            {
              functionDeclarations: tools.map((t) => ({
                name: t.name,
                description: t.description,
                parameters: t.parameters as any,
              })),
            },
          ]
        : undefined,
      toolConfig: {
        functionCallingConfig: {
          mode:
            toolChoice == 'auto'
              ? FunctionCallingMode.AUTO
              : FunctionCallingMode.ANY,
        },
      },
    });

    const chat = genModel.startChat({
      history,
      ...(systemMsg ? { systemInstruction: systemMsg } : {}),
      generationConfig: {
        maxOutputTokens: maxTokens ?? 4096,
        temperature: temperature ?? 0.7,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });

    let final: EnhancedGenerateContentResponse;

    if (onToken) {
      const streamResult = await chat.sendMessageStream(lastMsg);
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          onToken(chunkText);
        }
      }

      final = await streamResult.response;
    } else {
      const result = await withRetry(() => chat.sendMessage(lastMsg));
      final = result.response;
    }

    const text = final.text() || '';
    const usage = final.usageMetadata;

    const toolCalls: NormalizedToolCall[] = (final.functionCalls() ?? []).map(
      (fc, i) => ({
        id: `google_fc_${i}`,
        name: fc.name,
        arguments: fc.args as Record<string, any>,
      }),
    );

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
  }
  async embedding(model: string, text: string): Promise<number[] | null> {
    if (!this.embeddingModels.includes(model)) {
      throw new Error(
        `Google Gemini does not support this embedding model: ${model}`,
      );
    }
    const genModel = this._client.getGenerativeModel({
      model,
    });

    const response = await genModel.embedContent({
      content: {
        parts: [
          {
            text,
          },
        ],
        role: 'user',
      },
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });

    return response.embedding.values;
  }
}
