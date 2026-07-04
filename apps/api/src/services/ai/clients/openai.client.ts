import OpenAI from 'openai';
import { CompletionResult, NormalizedToolCall } from '../types';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat';

export class OpenAIClient implements ModelClient {
  static readonly displayModels: ModelDefinition[] = [
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
  static readonly embeddingModels: string[] = [
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-embedding-ada-002',
  ];

  displayModels: ModelDefinition[] = OpenAIClient.displayModels;
  models: string[] = OpenAIClient.displayModels.map((m) => m.id);
  embeddingModels: string[] = OpenAIClient.embeddingModels;

  private _client: OpenAI;
  constructor(apiKey: string) {
    this._client = new OpenAI({ apiKey });
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
      throw new Error(`OpenAI does not support this model: ${model}`);
    }

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

    openAIMsgs.unshift({
      role: 'system',
      content: system,
    });

    const options = {
      model,
      messages: openAIMsgs,
      max_tokens: maxTokens,
      temperature,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
      tools: tools?.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      })),
      tool_choice:
        toolChoice === 'auto'
          ? 'auto'
          : toolChoice === 'required'
            ? 'required'
            : 'none',
    };

    let finishReason: string | null = null;
    const tcMap: Record<number, { id: string; name: string; args: string }> =
      {};

    let final: {
      text: string;
      usage: {
        inputTokens: number;
        outputTokens: number;
      };
    };

    if (onToken) {
      const stream = await this._client.chat.completions.create(
        {
          ...options,
          stream: true,
          stream_options: {
            include_usage: true,
          },
        } as ChatCompletionCreateParamsStreaming,
        { signal: opts?.signal },
      );

      let text = '';
      let usage = { inputTokens: 0, outputTokens: 0 };
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (delta.content) {
          onToken(delta.content);
          text += delta.content;
        }
        for (const tc of delta.tool_calls ?? []) {
          const idx = tc.index ?? 0;
          if (!tcMap[idx]) tcMap[idx] = { id: '', name: '', args: '' };
          const e = tcMap[idx];
          if (tc.id) e.id = tc.id;
          if (tc.function?.name) e.name += tc.function.name;
          if (tc.function?.arguments) e.args += tc.function.arguments;
        }
        usage = {
          inputTokens: chunk.usage?.prompt_tokens ?? 0,
          outputTokens: chunk.usage?.completion_tokens ?? 0,
        };
      }

      final = {
        text,
        usage,
      };
    } else {
      const response = await withRetry(() =>
        this._client.chat.completions.create(
          {
            ...options,
            stream: false,
          } as ChatCompletionCreateParamsNonStreaming,
          { signal: opts?.signal },
        ),
      );

      const choice = response.choices[0];
      const text = choice.message.content ?? '';
      final = {
        text,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
        },
      };
    }
    const toolCalls: NormalizedToolCall[] = Object.values(tcMap)
      .filter((tc) => tc.name)
      .map((tc) => ({
        id: tc.id,
        name: tc.name,
        arguments: JSON.parse(tc.args || '{}'),
      }));
    const stopReason =
      finishReason === 'tool_calls'
        ? 'tool_use'
        : finishReason === 'length'
          ? 'max_tokens'
          : 'end_turn';
    return {
      text: final.text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: final.usage,
    };
  }
  async embedding(model: string, text: string): Promise<number[] | null> {
    if (!this.embeddingModels.includes(model)) {
      throw new Error(`OpenAI does not support this embedding model: ${model}`);
    }
    const response = await this._client.embeddings.create({
      model,
      input: text,
    });

    const em = response.data[0].embedding;
    return em;
  }
}
