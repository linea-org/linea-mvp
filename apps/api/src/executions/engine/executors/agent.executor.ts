import { interrupt } from '@langchain/langgraph';
import {
  AI_MODEL_CATALOG,
  type ModelDefinition,
} from '../../../services/ai/model-catalog';
import type {
  ChatMessage,
  NormalizedToolCall,
  CompletionResult,
} from '../../../services/ai/types';
import type {
  ModelClient,
  ModelChatProps,
} from '../../../services/ai/clients/interface';
import { AIService } from '../../../services/ai/ai.service';
import type { WorkflowState } from '../variable-substitution';
import { substituteVariables } from '../variable-substitution';
import { getEnabledTools, toolNeedsApproval } from '../tools/definitions';
import { executeTool } from '../tools/tool-executor';
import type { ToolExecutorContext } from '../tools/tool-executor';

const DEFAULT_MAX_STEPS = 10;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

type ChatOpts = Omit<ModelChatProps, 'messages'>;

/**
 * Wraps an onToken callback to suppress <think>...</think> blocks that
 * reasoning models (QwQ, Qwen3, DeepSeek-R1) emit before their real answer.
 * Handles tag content split across multiple token deltas.
 */
function wrapOnToken(
  onToken: ((delta: string) => void) | undefined,
): ((delta: string) => void) | undefined {
  if (!onToken) return undefined;
  const OPEN = '<think>';
  const CLOSE = '</think>';
  let inThink = false;
  let buf = '';
  return (delta: string) => {
    buf += delta;
    let out = '';
    while (buf.length > 0) {
      if (inThink) {
        const closeIdx = buf.indexOf(CLOSE);
        if (closeIdx !== -1) {
          inThink = false;
          buf = buf.slice(closeIdx + CLOSE.length).trimStart();
        } else {
          // Hold back any suffix that could be the start of </think>
          let partialLen = 0;
          for (let i = 1; i < CLOSE.length; i++) {
            if (buf.endsWith(CLOSE.slice(0, i))) partialLen = i;
          }
          buf = partialLen > 0 ? buf.slice(buf.length - partialLen) : '';
          break;
        }
      } else {
        const openIdx = buf.indexOf(OPEN);
        if (openIdx !== -1) {
          out += buf.slice(0, openIdx);
          inThink = true;
          buf = buf.slice(openIdx + OPEN.length);
        } else {
          // Hold back any suffix that could be the start of <think>
          let partialLen = 0;
          for (let i = 1; i < OPEN.length; i++) {
            if (buf.endsWith(OPEN.slice(0, i))) partialLen = i;
          }
          out += buf.slice(0, buf.length - partialLen);
          buf = partialLen > 0 ? buf.slice(buf.length - partialLen) : '';
          break;
        }
      }
    }
    if (out) onToken(out);
  };
}

async function callModel(
  client: ModelClient,
  modelDef: ModelDefinition,
  messages: ChatMessage[],
  opts: ChatOpts,
): Promise<CompletionResult> {
  return client.chat(modelDef.id, { messages, ...opts });
}

export interface AgentResult {
  __agentValue: string;
  __usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  __chatHistoryUpdates: Array<{ role: string; content: string }>;
  __variableUpdates: Record<string, unknown>;
  __memoryUpdates: Record<string, unknown>;
  __toolCallLog: Array<{
    step: number;
    name: string;
    args: Record<string, any>;
    result: unknown;
  }>;
  __modelId: string;
  __provider: string;
}

export interface LongTermMemoryContext {
  workspaceId: string;
  workflowId: string | undefined;
  threadId: string;
  store: (key: string, value: string) => Promise<void>;
  search: (
    query: string,
    topK: number,
  ) => Promise<Array<{ key: string; value: unknown; score: number }>>;
  loadRecent: (topK: number) => Promise<Array<{ key: string; value: unknown }>>;
}

export async function executeAgentNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
  aiService: AIService,
  workspaceId: string,
  ltmCtx?: LongTermMemoryContext,
  onToken?: (delta: string) => void,
): Promise<AgentResult> {
  // Filter <think> blocks from streaming output of reasoning models
  const filteredOnToken = wrapOnToken(onToken);

  const modelId: string | undefined = nodeData.model;
  if (!modelId) {
    throw new Error(
      'No model selected for this Agent node — set one in the node configuration.',
    );
  }
  const modelDef = AI_MODEL_CATALOG.find((m) => m.id === modelId);
  if (!modelDef) {
    throw new Error(`No model selected: unknown model "${modelId}"`);
  }
  const client = await aiService.initialize(workspaceId, modelDef.provider);

  const maxSteps: number = nodeData.maxSteps ?? DEFAULT_MAX_STEPS;
  const toolNames: string[] = nodeData.tools ?? [];
  const approvalOverrides: Record<string, 'never' | 'always' | 'on_mutation'> =
    nodeData.toolApprovals ?? {};
  const tools = getEnabledTools(toolNames, approvalOverrides);

  const instructions = substituteVariables(
    nodeData.instructions || 'Process the input',
    state,
  );
  const lastOutput = state.variables?.lastOutput;

  let longTermMemoryCtx = '';
  if (ltmCtx && (nodeData.enableLongTermMemory ?? false)) {
    try {
      const recentMemories = await ltmCtx.loadRecent(8);
      if (recentMemories.length > 0) {
        longTermMemoryCtx =
          '\n\nLong-term memory from previous executions:\n' +
          recentMemories
            .map(
              ({ key, value }) =>
                `- ${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}`,
            )
            .join('\n');
      }
    } catch {
      // Non-fatal — proceed without long-term context
    }
  }

  const memoryCtx =
    state.memory && Object.keys(state.memory).length > 0
      ? '\n\nSession memory:\n' +
        Object.entries(state.memory)
          .map(
            ([k, v]) =>
              `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`,
          )
          .join('\n')
      : '';

  const userContent =
    instructions +
    longTermMemoryCtx +
    memoryCtx +
    (lastOutput != null
      ? `\n\nPrevious step output:\n${
          typeof lastOutput === 'object'
            ? JSON.stringify(lastOutput, null, 2)
            : lastOutput
        }`
      : '');

  const messages: ChatMessage[] = [];

  // H-2: systemPrompt is inserted verbatim — NO variable substitution here.
  // Substitution only applies to `instructions` (the user turn), where the
  // resolved values are already sanitized against second-order injection.
  // Keeping systemPrompt static prevents an editor-role user from using
  // runtime input variables to override the system-level behaviour.
  if (nodeData.systemPrompt) {
    messages.push({ role: 'system', content: nodeData.systemPrompt });
  }

  if ((nodeData.includeChatHistory ?? false) && state.chatHistory?.length) {
    for (const msg of state.chatHistory) {
      messages.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  // If the node requests structured output, inject schema into the user message
  let structuredSchema: unknown = null;
  if (nodeData.outputSchema) {
    try {
      structuredSchema = JSON.parse(nodeData.outputSchema as string);
    } catch {
      // ignore invalid JSON schema
    }
    if (structuredSchema) {
      messages.push({
        role: 'user',
        content: `${userContent}\n\nYou MUST respond with ONLY a valid JSON object that strictly conforms to this JSON Schema. Output no text before or after the JSON object:\n${JSON.stringify(structuredSchema, null, 2)}`,
      });
    } else {
      messages.push({ role: 'user', content: userContent });
    }
  } else {
    messages.push({ role: 'user', content: userContent });
  }

  const totalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const toolCallLog: AgentResult['__toolCallLog'] = [];
  const variableUpdates: Record<string, unknown> = {};
  const memoryUpdates: Record<string, unknown> = {};

  // Build tool executor context for DB-backed memory operations
  const toolCtx: ToolExecutorContext | undefined = ltmCtx
    ? {
        memoryStore: (key, value) => ltmCtx.store(key, value),
        memorySearch: (query, topK) => ltmCtx.search(query, topK),
      }
    : undefined;

  const budgetPct: number = nodeData.contextBudgetPct ?? 0.8;

  for (let step = 0; step < maxSteps; step++) {
    // Temperature=0 on tool-calling steps for deterministic re-execution after
    // human approval. When the graph resumes, the loop re-runs; temp=0 ensures
    // the LLM makes the same choices so it hits the same interrupt() call.
    const temperature = tools.length > 0 ? 0 : (nodeData.temperature ?? 0.7);

    const response = await callModel(
      client,
      modelDef,
      await compactWithSummary(
        messages,
        modelDef.contextWindow,
        budgetPct,
        aiService,
        workspaceId,
      ),
      {
        maxTokens: nodeData.maxTokens ?? 4096,
        temperature,
        tools: tools.length ? tools : undefined,
        toolChoice: tools.length ? 'auto' : undefined,
        onToken: filteredOnToken,
      },
    );

    totalUsage.input_tokens += response.usage.inputTokens;
    totalUsage.output_tokens += response.usage.outputTokens;
    totalUsage.total_tokens +=
      response.usage.inputTokens + response.usage.outputTokens;

    if (!response.toolCalls?.length || response.stopReason === 'end_turn') {
      // Validate JSON when structured output is required; retry once on failure
      if (structuredSchema) {
        const parsed = tryParseJson(response.text);
        if (parsed !== null) {
          return buildResult(
            parsed as unknown as string,
            totalUsage,
            messages,
            variableUpdates,
            memoryUpdates,
            toolCallLog,
            modelDef,
            false,
          );
        }
        // Parsing failed — push a correction turn and continue if steps remain
        if (step < maxSteps - 1) {
          messages.push({ role: 'assistant', content: response.text });
          messages.push({
            role: 'user',
            content:
              'Your response was not valid JSON. Respond with ONLY a valid JSON object matching the required schema. No explanation, no code fences, no extra text.',
          });
          continue;
        }
        // Out of steps — fall through and return raw text
      }
      return buildResult(
        response.text,
        totalUsage,
        messages,
        variableUpdates,
        memoryUpdates,
        toolCallLog,
        modelDef,
        false,
      );
    }

    messages.push({
      role: 'assistant',
      content: response.text,
      toolCalls: response.toolCalls,
    });

    // Determine if this batch contains any interrupt-triggering calls.
    // ask_human and approval-required tools use interrupt() which requires
    // deterministic sequential re-execution — those batches stay sequential.
    const hasInterruptingTool = response.toolCalls.some(
      (tc) =>
        tc.name === 'ask_human' ||
        (tools.find((t) => t.name === tc.name) != null &&
          toolNeedsApproval(
            tools.find((t) => t.name === tc.name)!,
            tc.arguments,
          )),
    );

    if (hasInterruptingTool) {
      for (const toolCall of response.toolCalls) {
        const toolDef = tools.find((t) => t.name === toolCall.name);

        if (toolCall.name === 'ask_human') {
          const question = toolCall.arguments['question'] as string;
          const choices = toolCall.arguments['choices'] as string[] | undefined;
          const humanResponse = interrupt({
            type: 'ask_human',
            question,
            choices,
            nodeId: nodeData._nodeId,
            step,
          });
          const answer = humanResponse?.answer ?? '(no response)';
          messages.push({
            role: 'tool',
            content: answer,
            toolCallId: toolCall.id,
          });
          toolCallLog.push({
            step,
            name: 'ask_human',
            args: toolCall.arguments,
            result: answer,
          });
          continue;
        }

        if (toolDef && toolNeedsApproval(toolDef, toolCall.arguments)) {
          const decision = interrupt({
            type: 'tool_approval',
            toolName: toolCall.name,
            toolArgs: toolCall.arguments,
            nodeId: nodeData._nodeId,
            step,
            summary: buildApprovalSummary(toolCall),
          });
          if (!decision?.approved) {
            const denial = decision?.reason ?? 'User denied this action';
            messages.push({
              role: 'tool',
              content: `Action denied: ${denial}`,
              toolCallId: toolCall.id,
            });
            toolCallLog.push({
              step,
              name: toolCall.name,
              args: toolCall.arguments,
              result: { denied: true, reason: denial },
            });
            continue;
          }
        }

        const toolResult = await executeTool(toolCall, state, toolCtx);
        captureToolSideEffects(
          toolResult,
          variableUpdates,
          memoryUpdates,
          state,
        );
        const resultContent = toolResult.error
          ? `Error: ${toolResult.error}`
          : JSON.stringify(toolResult.output ?? null);
        messages.push({
          role: 'tool',
          content: resultContent,
          toolCallId: toolCall.id,
        });
        toolCallLog.push({
          step,
          name: toolCall.name,
          args: toolCall.arguments,
          result: toolResult.output,
        });
      }
    } else {
      // ── Parallel path: all tools in this batch are safe to run concurrently ─
      const settled = await Promise.all(
        response.toolCalls.map((tc) => executeTool(tc, state, toolCtx)),
      );
      for (let i = 0; i < response.toolCalls.length; i++) {
        const toolCall = response.toolCalls[i];
        const toolResult = settled[i];
        captureToolSideEffects(
          toolResult,
          variableUpdates,
          memoryUpdates,
          state,
        );
        const resultContent = toolResult.error
          ? `Error: ${toolResult.error}`
          : JSON.stringify(toolResult.output ?? null);
        messages.push({
          role: 'tool',
          content: resultContent,
          toolCallId: toolCall.id,
        });
        toolCallLog.push({
          step,
          name: toolCall.name,
          args: toolCall.arguments,
          result: toolResult.output,
        });
      }
    }
  }

  // Reached maxSteps without a final answer — return whatever the last text was
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  return buildResult(
    lastAssistantMsg?.content ?? `[Agent stopped after ${maxSteps} steps]`,
    totalUsage,
    messages,
    variableUpdates,
    memoryUpdates,
    toolCallLog,
    modelDef,
    true,
  );
}

function tryParseJson(text: string): unknown {
  try {
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function buildResult(
  text: string,
  usage: { input_tokens: number; output_tokens: number; total_tokens: number },
  messages: ChatMessage[],
  variableUpdates: Record<string, unknown>,
  memoryUpdates: Record<string, unknown>,
  toolCallLog: AgentResult['__toolCallLog'],
  modelDef: { id: string; provider: string },
  hitMaxSteps = false,
): AgentResult {
  const chatUpdates = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  // Strip <think>...</think> blocks emitted by reasoning models (QwQ, Qwen3, DeepSeek-R1, etc.)
  let finalValue: unknown =
    typeof text === 'string'
      ? text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()
      : text;

  if (hitMaxSteps && typeof finalValue === 'string') {
    finalValue = `${finalValue}\n\n[Note: reached maximum steps limit]`;
  }

  return {
    __agentValue: finalValue as string,
    __usage: usage,
    __chatHistoryUpdates: chatUpdates,
    __variableUpdates: variableUpdates,
    __memoryUpdates: memoryUpdates,
    __toolCallLog: toolCallLog,
    __modelId: modelDef.id,
    __provider: modelDef.provider,
  };
}

const TOOL_RESULT_MAX_CHARS = 8_000; // ~2 000 tokens; prevents single large API response blowing context
const SUMMARY_KEEP_LAST = 6; // always keep this many recent non-system messages verbatim

function estimateTokens(messages: ChatMessage[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

/**
 * Compact the message list to fit within the token budget.
 * When the list is over-budget, the oldest non-system turns are summarized
 * with the cheapest available model instead of being silently dropped.
 * Falls back to drop-oldest if the summarization call fails.
 */
async function compactWithSummary(
  messages: ChatMessage[],
  contextWindow: number,
  budgetPct: number,
  aiService: AIService,
  workspaceId: string,
): Promise<ChatMessage[]> {
  const budget = Math.floor(contextWindow * budgetPct);

  // Truncate oversized tool results in place first
  const capped = messages.map((m) =>
    m.role === 'tool' && m.content.length > TOOL_RESULT_MAX_CHARS
      ? {
          ...m,
          content: m.content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n[truncated]',
        }
      : m,
  );

  if (estimateTokens(capped) <= budget) return capped;

  const system = capped.filter((m) => m.role === 'system');
  const rest = capped.filter((m) => m.role !== 'system');

  if (rest.length <= SUMMARY_KEEP_LAST) {
    // Too few messages to split — fall back to drop-oldest
    while (rest.length > 1 && estimateTokens([...system, ...rest]) > budget)
      rest.shift();
    return [...system, ...rest];
  }

  const toSummarize = rest.slice(0, rest.length - SUMMARY_KEEP_LAST);
  const toKeep = rest.slice(rest.length - SUMMARY_KEEP_LAST);

  try {
    // Pick the cheapest model the workspace actually has a working client for
    const sortedByCost = AI_MODEL_CATALOG.filter(
      (m) => !m.capabilities.embedding,
    ).sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input);

    let summaryClient: ModelClient | null = null;
    let cheapestDef: ModelDefinition | undefined;
    for (const def of sortedByCost) {
      try {
        summaryClient = await aiService.initialize(workspaceId, def.provider);
        cheapestDef = def;
        break;
      } catch {
        continue;
      }
    }

    if (summaryClient && cheapestDef) {
      const convText = toSummarize
        .map((m) => `${m.role.toUpperCase()}: ${m.content.slice(0, 600)}`)
        .join('\n');

      const summaryResp = await summaryClient.chat(cheapestDef.id, {
        messages: [
          {
            role: 'user',
            content: `Summarize the following conversation history in 3-5 concise bullet points. Focus on key facts discovered, decisions made, and tool results. Be terse.\n\n${convText}`,
          },
        ],
        maxTokens: 512,
        temperature: 0,
      });

      const compacted = [
        ...system,
        {
          role: 'user' as const,
          content: `[Earlier context summary]\n${summaryResp.text}`,
        },
        ...toKeep,
      ];
      if (estimateTokens(compacted) <= budget) return compacted;
    }
  } catch {
    // Non-fatal — fall through to drop-oldest
  }

  // Fallback: drop oldest non-system messages until within budget
  const fallback = [...system, ...rest];
  while (fallback.length > 1 && estimateTokens(fallback) > budget) {
    const idx = fallback.findIndex((m) => m.role !== 'system');
    if (idx === -1) break;
    fallback.splice(idx, 1);
  }
  return fallback;
}

function captureToolSideEffects(
  toolResult: Awaited<ReturnType<typeof executeTool>>,
  variableUpdates: Record<string, unknown>,
  memoryUpdates: Record<string, unknown>,
  state: WorkflowState,
): void {
  if (toolResult.output && typeof toolResult.output === 'object') {
    const out = toolResult.output as any;
    if ('__writeVariable' in out) {
      const { name, value } = out.__writeVariable;
      if (name && !FORBIDDEN_KEYS.has(String(name)))
        variableUpdates[name] = value;
    }
    if ('__memoryWrite' in out) {
      const { key, value } = out.__memoryWrite;
      if (key && !FORBIDDEN_KEYS.has(String(key))) {
        memoryUpdates[key] = value;
        if (!state.memory) state.memory = {};
        state.memory[key] = value;
      }
    }
  }
}

function buildApprovalSummary(toolCall: NormalizedToolCall): string {
  switch (toolCall.name) {
    case 'http_request': {
      const { method, url } = toolCall.arguments;
      return `${method} ${url}`;
    }
    case 'run_javascript':
      return `Execute code:\n${String(toolCall.arguments['code']).slice(0, 300)}`;
    default:
      return JSON.stringify(toolCall.arguments, null, 2).slice(0, 400);
  }
}
