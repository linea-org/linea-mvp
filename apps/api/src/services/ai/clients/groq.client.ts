import OpenAI from 'openai';
import { CompletionResult, NormalizedToolCall } from '../types';
import { ModelChatProps, ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';
import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
} from 'openai/resources/chat';

export class GroqClient implements ModelClient {
  displayModels: ModelDefinition[] = [
    {
      id: 'llama-3.3-70b-versatile',
      name: 'Llama 3.3 70B',
      provider: 'groq',
      description:
        'Best Groq model for agentic and general tasks. 280 T/s, 131K context.',
      contextWindow: 131_072,
      maxOutputTokens: 32_768,
      tier: 'balanced',
      useCases: ['general', 'coding', 'fast-response'],
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 0.59, output: 0.79 },
      badge: 'recommended',
      status: 'production',
    },
    {
      id: 'llama-3.1-8b-instant',
      name: 'Llama 3.1 8B Instant',
      provider: 'groq',
      description:
        'Fastest Groq model — 560 T/s. Lowest cost for high-volume simple tasks.',
      contextWindow: 131_072,
      maxOutputTokens: 131_072,
      tier: 'fast',
      useCases: ['fast-response', 'conversation', 'data-extraction'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0.05, output: 0.08 },
      badge: 'fastest',
      status: 'production',
    },
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT OSS 120B (Groq)',
      provider: 'groq',
      description:
        'OpenAI open-source 120B on Groq hardware. 500 T/s, 65K output.',
      contextWindow: 131_072,
      maxOutputTokens: 65_536,
      tier: 'powerful',
      useCases: ['general', 'coding', 'reasoning', 'long-context'],
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 0.15, output: 0.6 },
      status: 'production',
    },
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT OSS 20B (Groq)',
      provider: 'groq',
      description:
        'OpenAI open-source 20B on Groq hardware. 1000 T/s — fastest large model.',
      contextWindow: 131_072,
      maxOutputTokens: 65_536,
      tier: 'fast',
      useCases: ['fast-response', 'general', 'data-extraction'],
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 0.075, output: 0.3 },
      badge: 'best-value',
      status: 'production',
    },
    {
      id: 'groq/compound',
      name: 'Groq Compound',
      provider: 'groq',
      description:
        'Groq agentic system with built-in web search and code execution. 450 T/s.',
      contextWindow: 131_072,
      maxOutputTokens: 8_192,
      tier: 'balanced',
      useCases: ['general', 'reasoning', 'coding'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0, output: 0 }, // pricing TBD
      status: 'production',
    },
    {
      id: 'groq/compound-mini',
      name: 'Groq Compound Mini',
      provider: 'groq',
      description:
        'Smaller Groq compound system. Fast + agentic for lighter workloads.',
      contextWindow: 131_072,
      maxOutputTokens: 8_192,
      tier: 'fast',
      useCases: ['fast-response', 'general'],
      capabilities: { vision: false, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0, output: 0 }, // pricing TBD
      status: 'production',
    },
    {
      id: 'meta-llama/llama-4-scout-17b-16e-instruct',
      name: 'Llama 4 Scout 17B',
      provider: 'groq',
      description:
        'Meta Llama 4 Scout on Groq. 750 T/s, multimodal (vision). Preview.',
      contextWindow: 131_072,
      maxOutputTokens: 8_192,
      tier: 'fast',
      useCases: ['fast-response', 'general', 'vision'],
      capabilities: { vision: true, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0.11, output: 0.34 },
      status: 'preview',
    },
    {
      id: 'qwen/qwen3-32b',
      name: 'Qwen 3 32B',
      provider: 'groq',
      description:
        'Alibaba Qwen3 32B on Groq. 400 T/s, strong coding and multilingual. Preview.',
      contextWindow: 131_072,
      maxOutputTokens: 40_960,
      tier: 'balanced',
      useCases: ['reasoning', 'coding', 'data-extraction', 'general'],
      capabilities: {
        vision: false,
        functionCalling: true,
        streaming: true,
        json: true,
      },
      costPer1mTokens: { input: 0.29, output: 0.59 },
      badge: 'best-reasoning',
      status: 'preview',
    },
  ];
  models: string[] = [
    ...this.displayModels.map((m) => m.id),
    'llama3.2',
    'deepseek-r1-distill-llama-70b',
  ];
  embeddingModels: string[] = [];

  private _client: OpenAI;
  constructor(apiKey: string) {
    this._client = new OpenAI({
      apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    });
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
      throw new Error(`Groq does not support this model: ${model}`);
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
      throw new Error(`Groq does not support this embedding model: ${model}`);
    }
    const response = await this._client.embeddings.create({
      model,
      input: text,
    });

    const em = response.data[0].embedding;
    return em;
  }
}
