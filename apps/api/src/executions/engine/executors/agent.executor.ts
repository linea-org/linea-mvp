import { interrupt } from '@langchain/langgraph';
import { getModelOrDefault, getModel } from '../models/registry';
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

const DEFAULT_MAX_STEPS = 10;

export interface AgentResult {
  __agentValue: string;
  __usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  __chatHistoryUpdates: Array<{ role: string; content: string }>;
  __variableUpdates: Record<string, unknown>;
  __toolCallLog: Array<{
    step: number;
    name: string;
    args: Record<string, any>;
    result: unknown;
  }>;
  __modelId: string;
  __provider: string;
}

export async function executeAgentNode(
  nodeData: Record<string, any>,
  state: WorkflowState,
  apiKeys: ModelApiKeys,
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
  const memoryCtx =
    state.memory && Object.keys(state.memory).length > 0
      ? '\n\nMemory:\n' +
        Object.entries(state.memory)
          .map(
            ([k, v]) =>
              `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`,
          )
          .join('\n')
      : '';

  const userContent =
    instructions +
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

  messages.push({ role: 'user', content: userContent });

  // ─── Agentic loop ──────────────────────────────────────────────────────────

  const totalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
  const toolCallLog: AgentResult['__toolCallLog'] = [];
  const variableUpdates: Record<string, unknown> = {};

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
      },
    );

    totalUsage.input_tokens += response.usage.inputTokens;
    totalUsage.output_tokens += response.usage.outputTokens;
    totalUsage.total_tokens +=
      response.usage.inputTokens + response.usage.outputTokens;

    // ── No tool calls — agent has a final answer ─────────────────────────────
    if (!response.toolCalls?.length || response.stopReason === 'end_turn') {
      return buildResult(
        response.text,
        totalUsage,
        messages,
        variableUpdates,
        toolCallLog,
        modelDef,
      );
    }

    // ── Has tool calls — process them ────────────────────────────────────────
    messages.push({
      role: 'assistant',
      content: response.text,
      toolCalls: response.toolCalls,
    });

    for (const toolCall of response.toolCalls) {
      const toolDef = tools.find((t) => t.name === toolCall.name);

      // ── ask_human: always pause, let the user answer ───────────────────────
      if (toolCall.name === 'ask_human') {
        const question = toolCall.arguments['question'] as string;
        const choices = toolCall.arguments['choices'] as string[] | undefined;

        // interrupt() suspends on first run, returns the resume value on re-run
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

      // ── Tools that need human approval ────────────────────────────────────
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

      // ── Execute the tool ──────────────────────────────────────────────────
      const toolResult = await executeTool(toolCall, state);

      // Capture variable writes
      if (
        toolResult.output &&
        typeof toolResult.output === 'object' &&
        '__writeVariable' in (toolResult.output as any)
      ) {
        const { name, value } = (toolResult.output as any).__writeVariable;
        variableUpdates[name] = value;
      }

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

  // Reached maxSteps without a final answer — return whatever the last text was
  const lastAssistantMsg = [...messages]
    .reverse()
    .find((m) => m.role === 'assistant');
  return buildResult(
    lastAssistantMsg?.content ?? `[Agent stopped after ${maxSteps} steps]`,
    totalUsage,
    messages,
    variableUpdates,
    toolCallLog,
    modelDef,
    true,
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildResult(
  text: string,
  usage: { input_tokens: number; output_tokens: number; total_tokens: number },
  messages: ChatMessage[],
  variableUpdates: Record<string, unknown>,
  toolCallLog: AgentResult['__toolCallLog'],
  modelDef: { id: string; provider: string },
  hitMaxSteps = false,
): AgentResult {
  const chatUpdates = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    __agentValue: hitMaxSteps
      ? `${text}\n\n[Note: reached maximum steps limit]`
      : text,
    __usage: usage,
    __chatHistoryUpdates: chatUpdates,
    __variableUpdates: variableUpdates,
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
