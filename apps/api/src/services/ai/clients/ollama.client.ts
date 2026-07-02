import OpenAI from 'openai';
import { CompletionResult, NormalizedToolCall } from '../types';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat';

export class OllamaClient implements ModelClient {
  displayModels: ModelDefinition[] = [
    {
      id: 'llama3.2',
      name: 'Llama 3.2',
      provider: 'ollama',
      description:
        "Meta's latest small model. Good all-rounder for local inference.",
      contextWindow: 128_000,
      maxOutputTokens: 4_096,
      tier: 'fast',
      useCases: ['general', 'fast-response', 'conversation'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0, output: 0 },
    },
    {
      id: 'qwen2.5',
      name: 'Qwen 2.5',
      provider: 'ollama',
      description:
        "Alibaba's versatile model. Excellent coding and multilingual support.",
      contextWindow: 128_000,
      maxOutputTokens: 4_096,
      tier: 'balanced',
      useCases: ['general', 'coding'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0, output: 0 },
      badge: 'recommended',
    },
    {
      id: 'deepseek-r1',
      name: 'DeepSeek R1',
      provider: 'ollama',
      description:
        'Open-source reasoning model. Competitive with frontier models on math.',
      contextWindow: 64_000,
      maxOutputTokens: 8_192,
      tier: 'reasoning',
      useCases: ['reasoning', 'coding'],
      capabilities: { vision: false, functionCalling: false, streaming: true },
      costPer1mTokens: { input: 0, output: 0 },
    },
    {
      id: 'mistral',
      name: 'Mistral 7B',
      provider: 'ollama',
      description:
        'Efficient 7B model. Great for fast local inference with tool use.',
      contextWindow: 8_192,
      maxOutputTokens: 4_096,
      tier: 'fast',
      useCases: ['general', 'conversation'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0, output: 0 },
    },
  ];
  models: string[] = this.displayModels.map((m) => m.id);
  embeddingModels: string[] = ['nomic-embed-text', 'mxbai-embed-large'];

  private _client: OpenAI;
  constructor(apiKey: string, baseURL: string) {
    this._client = new OpenAI({ apiKey, baseURL });
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
      throw new Error(`Ollama does not support this model: ${model}`);
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
      throw new Error(`Ollama does not support this embedding model: ${model}`);
    }
    const response = await this._client.embeddings.create({
      model,
      input: text,
    });

    const em = response.data[0].embedding;
    return em;
  }
}
