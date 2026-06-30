import { GoogleGenerativeAI } from '@google/generative-ai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { ProviderConfigMap } from '../common/utils/config-types';
import {
  FactoryMap,
  ModelClient,
  ModelProvider,
  NormalizedToolCall,
} from './types';
import { withRetry } from './helpers';

const factories: FactoryMap = {
  openai: (id: string, c: ProviderConfigMap['openai']) =>
    createOpenAIClient(id, c.apiKey),
  anthropic: (id: string, c: ProviderConfigMap['anthropic']) =>
    createAnthropicClient(id, c.apiKey),
  google: (id: string, c: ProviderConfigMap['google']) =>
    createGoogleClient(id, c.apiKey),
  ollama: (id: string, c: ProviderConfigMap['ollama']) =>
    createOpenAIClient(id, 'ollama', `${c.host}/v1`),
  groq: (id: string, c: ProviderConfigMap['groq']) =>
    createOpenAIClient(id, c.apiKey, 'https://api.groq.com/openai/v1'),
  xai: (id: string, c: ProviderConfigMap['xai']) =>
    createOpenAIClient(id, c.apiKey, 'https://api.x.ai/v1'),
};

export function createModelClient<T extends ModelProvider>(
  modelId: string,
  provider: T,
  config: ProviderConfigMap[T],
) {
  return factories[provider](modelId, config);
}

function createAnthropicClient(modelId: string, apiKey: string): ModelClient {
  return async (messages, opts = {}) => {
    const client = new Anthropic({ apiKey });

    const systemMsg = messages.find((m) => m.role === 'system');
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

    const anthropicTools = opts.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));

    const msgParams: any = {
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
    };

    let response: any;
    if (opts.onToken) {
      const stream = (client.messages as any).stream(msgParams);
      stream.on('text', opts.onToken);
      response = await stream.finalMessage();
    } else {
      response = await withRetry(() => client.messages.create(msgParams));
    }

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text as string)
      .join('');

    const toolCalls: NormalizedToolCall[] = response.content
      .filter((b: any) => b.type === 'tool_use')
      .map((b: any) => ({
        id: b.id,
        name: b.name,
        arguments: b.input ?? {},
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

function createOpenAIClient(
  modelId: string,
  apiKey: string,
  baseURL?: string,
): ModelClient {
  return async (messages, opts = {}) => {
    const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });

    const isReasoningModel = /^o[1-9]/.test(modelId);

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

    const baseParams: any = {
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
    };

    if (opts.onToken) {
      const stream: any = await client.chat.completions.create(
        { ...baseParams, stream: true },
        { signal: opts.signal },
      );
      let text = '';
      const tcMap: Record<number, { id: string; name: string; args: string }> =
        {};
      let finishReason: string | null = null;
      for await (const chunk of stream) {
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;
        const delta = choice.delta;
        if (delta.content) {
          opts.onToken(delta.content);
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
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        stopReason,
        usage: { inputTokens: 0, outputTokens: 0 },
      };
    }

    const response = await withRetry(() =>
      client.chat.completions.create(baseParams, { signal: opts.signal }),
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

function createGoogleClient(modelId: string, apiKey: string): ModelClient {
  return async (messages, opts = {}) => {
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

    if (opts.onToken) {
      const streamResult = await chat.sendMessageStream(lastMsg);
      let text = '';
      for await (const chunk of streamResult.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          opts.onToken(chunkText);
          text += chunkText;
        }
      }
      const response = await streamResult.response;
      const usage = response.usageMetadata;
      const toolCalls: NormalizedToolCall[] = (
        response.functionCalls() ?? []
      ).map((fc, i) => ({
        id: `google_fc_${i}`,
        name: fc.name,
        arguments: fc.args as Record<string, any>,
      }));
      return {
        text,
        toolCalls: toolCalls.length ? toolCalls : undefined,
        stopReason: toolCalls.length ? 'tool_use' : 'end_turn',
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
      };
    }

    const result = await withRetry(() => chat.sendMessage(lastMsg));
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
