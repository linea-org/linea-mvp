import OpenAI from 'openai';
import { CompletionResult, NormalizedToolCall } from '../types';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat';

export class XAIClient implements ModelClient {
  displayModels: ModelDefinition[] = [
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
  models: string[] = this.displayModels.map((m) => m.id);
  embeddingModels: string[] = [
    'text-embedding-3-small',
    'text-embedding-3-large',
    'text-embedding-ada-002',
  ];

  private _client: OpenAI;
  constructor(apiKey: string) {
    this._client = new OpenAI({ apiKey, baseURL: 'https://api.x.ai/v1' });
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
      throw new Error(`xAI does not support this model: ${model}`);
    }

    const msgs: any[] = messages.map((m) => {
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

    msgs.unshift({
      role: 'system',
      content: system,
    });

    const options = {
      model,
      messages: msgs,
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
          outputTokens: chunk.usage?.completion_tokens ?? 0,
          inputTokens: chunk.usage?.prompt_tokens ?? 0,
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
      throw new Error(`xAI does not support this embedding model: ${model}`);
    }
    const response = await this._client.embeddings.create({
      model,
      input: text,
    });

    const em = response.data[0].embedding;
    return em;
  }
}
