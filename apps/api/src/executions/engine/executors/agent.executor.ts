import { interrupt } from '@langchain/langgraph';
import { getModelOrDefault } from '../models/registry';
import { createModelClient } from '../models/client.factory';
import type {
  ChatMessage,
  NormalizedToolCall,
  ModelApiKeys,
} from '../models/client.factory';
import type { WorkflowState } from '../variable-substitution';
import { substituteVariables } from '../variable-substitution';
import { getEnabledTools, toolNeedsApproval } from '../tools/definitions';
import { executeTool } from '../tools/tool-executor';
import type { ToolExecutorContext } from '../tools/tool-executor';

const DEFAULT_MAX_STEPS = 10;
const FORBIDDEN_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

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
  apiKeys: ModelApiKeys,
  ltmCtx?: LongTermMemoryContext,
  onToken?: (delta: string) => void,
): Promise<AgentResult> {
  const modelDef = getModelOrDefault(nodeData.model, 'balanced');
  const client = createModelClient(modelDef.id, modelDef.provider, apiKeys);

  const maxSteps: number = nodeData.maxSteps ?? DEFAULT_MAX_STEPS;
  const toolNames: string[] = nodeData.tools ?? [];
  const approvalOverrides: Record<string, 'never' | 'always' | 'on_mutation'> =
    nodeData.toolApprovals ?? {};
  const tools = getEnabledTools(toolNames, approvalOverrides);

  // ─── Build initial messages ────────────────────────────────────────────────

  const instructions = substituteVariables(
    nodeData.instructions || 'Process the input',
    state,
  );
  const lastOutput = state.variables?.lastOutput;

  // ── Long-term memory: load recent facts and inject into context ─────────
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

  // ─── Agentic loop ──────────────────────────────────────────────────────────

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

    const response = await client(
      trimToTokenBudget(messages, modelDef.contextWindow, budgetPct),
      {
        maxTokens: nodeData.maxTokens ?? 4096,
        temperature,
        tools: tools.length ? tools : undefined,
        toolChoice: tools.length ? 'auto' : undefined,
        onToken,
      },
    );

    totalUsage.input_tokens += response.usage.inputTokens;
    totalUsage.output_tokens += response.usage.outputTokens;
    totalUsage.total_tokens +=
      response.usage.inputTokens + response.usage.outputTokens;

    // ── No tool calls — agent has a final answer ─────────────────────────────
    if (!response.toolCalls?.length || response.stopReason === 'end_turn') {
      // Validate JSON when structured output is required; retry once on failure
      if (structuredSchema) {
        const parsed = tryParseJson(response.text);
        if (parsed !== null) {
          return buildResult(parsed as unknown as string, totalUsage, messages, variableUpdates, memoryUpdates, toolCallLog, modelDef, false, null);
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
        structuredSchema,
      );
    }

    // ── Has tool calls — process them ────────────────────────────────────────
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
          toolNeedsApproval(tools.find((t) => t.name === tc.name)!, tc.arguments)),
    );

    if (hasInterruptingTool) {
      // ── Sequential path: required for interrupt() correctness ──────────────
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
          messages.push({ role: 'tool', content: answer, toolCallId: toolCall.id });
          toolCallLog.push({ step, name: 'ask_human', args: toolCall.arguments, result: answer });
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
            messages.push({ role: 'tool', content: `Action denied: ${denial}`, toolCallId: toolCall.id });
            toolCallLog.push({ step, name: toolCall.name, args: toolCall.arguments, result: { denied: true, reason: denial } });
            continue;
          }
        }

        const toolResult = await executeTool(toolCall, state, toolCtx);
        captureToolSideEffects(toolResult, variableUpdates, memoryUpdates, state);
        const resultContent = toolResult.error ? `Error: ${toolResult.error}` : JSON.stringify(toolResult.output ?? null);
        messages.push({ role: 'tool', content: resultContent, toolCallId: toolCall.id });
        toolCallLog.push({ step, name: toolCall.name, args: toolCall.arguments, result: toolResult.output });
      }
    } else {
      // ── Parallel path: all tools in this batch are safe to run concurrently ─
      const settled = await Promise.all(
        response.toolCalls.map((tc) => executeTool(tc, state, toolCtx)),
      );
      for (let i = 0; i < response.toolCalls.length; i++) {
        const toolCall = response.toolCalls[i]!;
        const toolResult = settled[i]!;
        captureToolSideEffects(toolResult, variableUpdates, memoryUpdates, state);
        const resultContent = toolResult.error ? `Error: ${toolResult.error}` : JSON.stringify(toolResult.output ?? null);
        messages.push({ role: 'tool', content: resultContent, toolCallId: toolCall.id });
        toolCallLog.push({ step, name: toolCall.name, args: toolCall.arguments, result: toolResult.output });
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
    structuredSchema,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  structuredSchema: unknown = null,
): AgentResult {
  const chatUpdates = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  let finalValue: unknown = text;

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

// ─── Context compaction ───────────────────────────────────────────────────────

const TOOL_RESULT_MAX_CHARS = 8_000; // ~2 000 tokens; prevents single large API response blowing context

function estimateTokens(messages: ChatMessage[]): number {
  return Math.ceil(JSON.stringify(messages).length / 4);
}

function trimToTokenBudget(
  messages: ChatMessage[],
  contextWindow: number,
  budgetPct: number,
): ChatMessage[] {
  const budget = Math.floor(contextWindow * budgetPct);

  // Truncate oversized tool-result content in place first
  const capped = messages.map((m) =>
    m.role === 'tool' && m.content.length > TOOL_RESULT_MAX_CHARS
      ? {
          ...m,
          content: m.content.slice(0, TOOL_RESULT_MAX_CHARS) + '\n[truncated]',
        }
      : m,
  );

  if (estimateTokens(capped) <= budget) return capped;

  // Separate system messages (keep always) from the rest
  const system = capped.filter((m) => m.role === 'system');
  const rest = capped.filter((m) => m.role !== 'system');

  // Drop from the oldest end of rest until within budget, keeping at least the last message
  while (rest.length > 1 && estimateTokens([...system, ...rest]) > budget) {
    rest.shift();
  }

  return [...system, ...rest];
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
      if (name && !FORBIDDEN_KEYS.has(String(name))) variableUpdates[name] = value;
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
