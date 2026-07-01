import {
  EnhancedGenerateContentResponse,
  FunctionCallingMode,
  GoogleGenerativeAI,
  TaskType,
} from '@google/generative-ai';
import { CompletionResult, NormalizedToolCall } from '../types';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';

export class GoogleClient implements ModelClient {
  displayModels: ModelDefinition[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      description:
        'Flagship multimodal model. Excellent for vision tasks and general workflows.',
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      tier: 'balanced',
      useCases: ['general', 'coding', 'vision', 'data-extraction'],
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 2.5, output: 10 },
      badge: 'recommended',
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      description:
        'Ultra-affordable with vision. Best value for high-volume, simple tasks.',
      contextWindow: 128_000,
      maxOutputTokens: 16_384,
      tier: 'fast',
      useCases: ['fast-response', 'data-extraction', 'conversation'],
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 0.15, output: 0.6 },
      badge: 'best-value',
    },
    {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      provider: 'openai',
      description:
        'Optimized for long-context coding and instruction following.',
      contextWindow: 1_047_576,
      maxOutputTokens: 32_768,
      tier: 'balanced',
      useCases: ['coding', 'long-context', 'general'],
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 2, output: 8 },
    },
    {
      id: 'o4-mini',
      name: 'o4 Mini',
      provider: 'openai',
      description:
        'Fast reasoning model. Best for math, science, and multi-step logic.',
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      tier: 'reasoning',
      useCases: ['reasoning', 'coding'],
      capabilities: { vision: true, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 1.1, output: 4.4 },
      badge: 'best-reasoning',
    },
    {
      id: 'o3',
      name: 'o3',
      provider: 'openai',
      description:
        'Most powerful OpenAI reasoning model for frontier-level problems.',
      contextWindow: 200_000,
      maxOutputTokens: 100_000,
      tier: 'reasoning',
      useCases: ['reasoning', 'coding'],
      capabilities: { vision: true, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 10, output: 40 },
    },
  ];

  models: string[] = this.displayModels.map((m) => m.id);

  embeddingModels: string[] = [
    'gemini-embedding-001',
    'text-embedding-005',
    'text-multilingual-embedding-002',
  ];

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
      opts,
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
      let text = '';
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          opts.onToken(chunkText);
          text += chunkText;
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
