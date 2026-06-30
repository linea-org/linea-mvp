import Anthropic from '@anthropic-ai/sdk';
import { ToolDefinition } from '../tools/definitions';
import { ChatMessage, CompletionResult, NormalizedToolCall } from '../types';
import { ModelClient, ModelDefinition } from './interface';
import { withRetry } from '../helpers';

export class AnthropicClient implements ModelClient {
  private _client: Anthropic;

  constructor(apiKey: string) {
    this._client = new Anthropic({ apiKey });
  }

  displayModels: ModelDefinition[] = [
    {
      id: 'claude-opus-4-7',
      name: 'Claude Opus 4.7',
      provider: 'anthropic',
      description:
        'Most powerful Claude model. Best for complex multi-step reasoning and coding.',
      contextWindow: 200_000,
      maxOutputTokens: 32_000,
      tier: 'powerful',
      useCases: ['general', 'coding', 'reasoning', 'vision'],
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        extendedThinking: true,
      },
      costPer1mTokens: { input: 15, output: 75 },
      badge: 'most-capable',
    },
    {
      id: 'claude-sonnet-4-6',
      name: 'Claude Sonnet 4.6',
      provider: 'anthropic',
      description:
        'Best all-around model. Ideal for agentic workflows, coding, and analysis.',
      contextWindow: 200_000,
      maxOutputTokens: 16_000,
      tier: 'balanced',
      useCases: ['general', 'coding', 'vision', 'data-extraction'],
      capabilities: {
        vision: true,
        functionCalling: true,
        streaming: true,
        extendedThinking: true,
      },
      costPer1mTokens: { input: 3, output: 15 },
      badge: 'best-for-agents',
    },
    {
      id: 'claude-haiku-4-5',
      name: 'Claude Haiku 4.5',
      provider: 'anthropic',
      description:
        'Fastest Claude model. Great for classification, extraction, and high-volume tasks.',
      contextWindow: 200_000,
      maxOutputTokens: 8_000,
      tier: 'fast',
      useCases: ['fast-response', 'conversation', 'data-extraction'],
      capabilities: { vision: true, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 0.8, output: 4 },
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet (legacy)',
      provider: 'anthropic',
      description:
        'Previous generation Sonnet. Still excellent for coding and general tasks.',
      contextWindow: 200_000,
      maxOutputTokens: 8_096,
      tier: 'balanced',
      useCases: ['general', 'coding', 'vision'],
      capabilities: { vision: true, functionCalling: true, streaming: true },
      costPer1mTokens: { input: 3, output: 15 },
    },
  ];

  models: string[] = this.displayModels.map((m) => m.id);

  embeddingModels: string[] = [];

  async chat(
    model: string,
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    temperature?: number,
    toolChoice?: 'auto' | 'required',
    maxTokens?: number,
    system?: string,
    jsonMode?: boolean,
    onToken?: (delta: String) => void,
    opts?: any,
  ): Promise<CompletionResult> {
    if (!this.models.includes(model)) {
      throw new Error(`Anthropic does not support this model: ${model}`);
    }

    const systemMsg =
      messages.find((m) => m.role === 'system')?.content || system;
    const chatMsgs = messages.filter((m) => m.role !== 'system');

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

    const options = {
      model: model,
      messages: anthropicMsgs,
      max_tokens: maxTokens ?? 4096,
      temperature: temperature,
      system: systemMsg,
      tools: tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      })),
      tool_choice:
        toolChoice === 'required'
          ? { type: 'any' as const }
          : toolChoice === 'auto'
            ? { type: 'auto' as const }
            : undefined,
    };

    let final: Anthropic.Messages.Message;
    if (onToken) {
      const stream = this._client.messages.stream(options);

      stream.on('text', onToken);
      final = await stream.finalMessage();
    } else {
      final = await withRetry(() => this._client.messages.create(options));
    }
    const text = final.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text as string)
      .join('');
    const toolCalls: NormalizedToolCall[] = final.content
      .filter((b: any) => b.type === 'tool_use')
      .map((b: any) => ({
        id: b.id,
        name: b.name,
        arguments: b.input ?? {},
      }));

    const stopReason =
      final.stop_reason === 'tool_use'
        ? 'tool_use'
        : final.stop_reason === 'max_tokens'
          ? 'max_tokens'
          : 'end_turn';

    return {
      text,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      stopReason,
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      },
    };
  }
  embedding(model: string, text: string): Promise<number[] | null> {
    throw new Error("Anthropic don't have embedding models");
  }
}
