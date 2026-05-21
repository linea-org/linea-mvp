import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq, and, desc } from 'drizzle-orm';
import { StateGraph, Annotation, START, END } from '@langchain/langgraph';
import type { DrizzleDB } from '@linea/db';
import { pods, workflows, executions, schedules, agentChatSessions } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { SecretsService } from '../secrets/secrets.service';
import { ExecutionsService } from '../executions/executions.service';
import { MemoryService } from '../executions/engine/memory.service';
import { CheckpointerService } from '../executions/engine/checkpointer.service';
import { createModelClient } from '../executions/engine/models/client.factory';
import { MODEL_REGISTRY } from '../executions/engine/models/registry';
import type {
  ModelApiKeys,
  ChatMessage as ModelChatMessage,
  NormalizedToolCall,
  ModelClient,
} from '../executions/engine/models/client.factory';
import type { ToolDefinition } from '../executions/engine/tools/definitions';
import type { ChatDto } from './dto/chat.dto';

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Linea's built-in AI assistant. Linea is a visual workflow automation platform (like n8n, Make.com, or Zapier) where automations are built by connecting nodes on a canvas.

## Node Types (all have: id, type, position {x,y}, data {nodeType, nodeName, ...fields})

- **start** — Entry point. data: {inputVariables: [{name, type, required?, description?, defaultValue?}]}
- **end** — Terminal node. data: {}
- **agent** — AI LLM agent. data: {model: string, systemPrompt: string, userPrompt: string, temperature?: number}
  Available models: claude-sonnet-4-6, claude-opus-4-7, gpt-4o, gpt-4o-mini, gemini-2.0-flash, llama3.2, mistral, qwen2.5
- **http** — HTTP request. data: {method: "GET"|"POST"|"PUT"|"DELETE"|"PATCH", url: string, headers?: object, body?: string}
- **code** — JavaScript executor. data: {code: string} (must export async default function(input){return result;})
- **transform** — Template. data: {template: string} (use {{input.fieldName}} for substitution)
- **if-else** — Boolean branch. data: {condition: string (JS expression, refs input.*)}; handles: "true", "false"
- **router** — N-way branch. data: {routes: [{id: string, label: string, condition: string}]}; handles: each route.id
- **loop** — Iterate. data: {inputPath: string (dot-path to array), outputKey: string}
- **parallel** — Concurrent branches. data: {branches?: number}
- **slack** — Send message. data: {channel: string, message: string} [requires SLACK_BOT_TOKEN]
- **gmail** — Send email. data: {to: string, subject: string, body: string} [requires Gmail OAuth]
- **github** — GitHub ops. data: {action: "create_issue"|"create_pr"|"list_prs", repo: string, title?: string, body?: string} [requires GITHUB_TOKEN]
- **notion** — Notion ops. data: {action: "create_page"|"list_pages", databaseId?: string, title?: string, properties?: object} [requires NOTION_TOKEN]
- **memory** — Key-value store. data: {action: "store"|"retrieve", key: string, value?: string}
- **retriever** — Vector search. data: {query: string, topK?: number}
- **mcp** — MCP tool. data: {serverId: string, tool: string, parameters?: object}
- **wait** — Pause. data: {duration: number, unit: "seconds"|"minutes"|"hours"}
- **approval** — Human-in-loop. data: {message: string, prompt?: string}
- **extract** — AI extraction. data: {schema: object, prompt: string, model?: string}
- **evaluator** — Score output. data: {criteria: string, model?: string}
- **subworkflow** — Call other workflow. data: {workflowId: string, input?: object}

## Edge Format
{id: string, source: nodeId, target: nodeId, sourceHandle?: string}
- if-else: sourceHandle = "true" or "false"
- router: sourceHandle = route.id
- others: no sourceHandle

## Required Secrets (set in Settings → Secrets)
- ANTHROPIC_API_KEY — Claude models
- OPENAI_API_KEY — GPT models
- GROQ_API_KEY — Groq models
- GOOGLE_API_KEY — Gemini models
- SLACK_BOT_TOKEN — Slack
- GITHUB_TOKEN — GitHub
- NOTION_TOKEN — Notion

## How to Help
1. Use check_workspace_secrets to know what's available
2. Use list_pods to find where to create workflows
3. Plan the automation clearly, node by node
4. Use create_workflow to build it (set realistic node positions)
5. If missing secrets: list exactly which ones to add and where (Settings → Secrets)
6. Use run_workflow to test an existing workflow — pass input: { message: "..." } for chat-style workflows
7. Use save_to_memory to remember user preferences, names, or facts across conversations
8. Use list_executions / get_execution to inspect recent runs and debug failures
9. Use list_schedules to show what's scheduled in a pod

Be direct, clear, and structured. Use emoji section headers for readability.`;

// ─── Tools ────────────────────────────────────────────────────────────────────

const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'check_workspace_secrets',
    description: 'Check which API keys and secrets are configured in this workspace. Returns secret names (not values).',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'list_pods',
    description: 'List all pods (projects/environments) in this workspace.',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'list_workflows',
    description: 'List all workflows in a specific pod.',
    parameters: {
      type: 'object',
      properties: { pod_id: { type: 'string', description: 'The pod ID to list workflows for' } },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'create_workflow',
    description: 'Create a new workflow in a pod. Provide a complete node/edge definition.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to create the workflow in' },
        name: { type: 'string', description: 'Workflow name' },
        description: { type: 'string', description: 'Short description' },
        definition: {
          type: 'object',
          description: 'Workflow definition with nodes and edges arrays',
          properties: { nodes: { type: 'array' }, edges: { type: 'array' } },
          required: ['nodes', 'edges'],
        },
      },
      required: ['pod_id', 'name', 'definition'],
    },
    approval: 'never',
  },
  {
    name: 'run_workflow',
    description: 'Trigger a workflow execution and wait for its result (up to 60 seconds). For chatbot workflows pass input: { message: "..." }. Returns output on success, or an error.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID that owns the workflow' },
        workflow_id: { type: 'string', description: 'Workflow ID to execute' },
        input: { type: 'object', description: 'Input variables', properties: {}, required: [] },
      },
      required: ['pod_id', 'workflow_id'],
    },
    approval: 'never',
  },
  {
    name: 'save_to_memory',
    description: 'Persist a piece of information so you can recall it in future conversations with this user. Use for names, preferences, context, or any fact worth remembering long-term.',
    parameters: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'Short descriptive key, e.g. "user_name" or "preferred_language"' },
        value: { type: 'string', description: 'The information to remember' },
      },
      required: ['key', 'value'],
    },
    approval: 'never',
  },
  {
    name: 'list_executions',
    description: 'List recent executions for a pod, optionally filtered by workflow. Returns id, status, triggeredBy, startedAt, finishedAt.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to list executions for' },
        workflow_id: { type: 'string', description: 'Optional: filter by workflow ID' },
        limit: { type: 'number', description: 'Max results (default 10, max 50)' },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'get_execution',
    description: 'Get details of a specific execution — status, output, error, node results.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID that owns the execution' },
        execution_id: { type: 'string', description: 'Execution ID' },
      },
      required: ['pod_id', 'execution_id'],
    },
    approval: 'never',
  },
  {
    name: 'list_schedules',
    description: 'List scheduled triggers for a pod — cron expression, enabled state, last and next run times.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to list schedules for' },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
];

const PROVIDER_KEY_MAP: Partial<Record<string, keyof ModelApiKeys>> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  groq: 'GROQ_API_KEY',
  google: 'GOOGLE_API_KEY',
  xai: 'XAI_API_KEY',
};

// ─── LangGraph state ──────────────────────────────────────────────────────────

const AgentStateAnnotation = Annotation.Root({
  // REPLACE reducer: each invoke passes the full message history, so we always
  // want the latest snapshot rather than appending to a stale checkpoint.
  messages: Annotation<ModelChatMessage[]>({
    reducer: (_, r) => r,
    default: () => [],
  }),
  pendingTools: Annotation<NormalizedToolCall[] | null>({
    reducer: (_, r) => r,
    default: () => null,
  }),
});

type AgentStateType = typeof AgentStateAnnotation.State;

// ─── Async event channel ──────────────────────────────────────────────────────

function createEventChannel() {
  const DONE = Symbol('done');
  const queue: Array<object | symbol> = [];
  let resolver: (() => void) | null = null;

  const push = (item: object | symbol) => {
    queue.push(item);
    const r = resolver;
    resolver = null;
    r?.();
  };

  async function* read(): AsyncGenerator<object> {
    while (true) {
      while (queue.length > 0) {
        const item = queue.shift()!;
        if (item === DONE) return;
        yield item as object;
      }
      await new Promise<void>((r) => { resolver = r; });
    }
  }

  return { emit: (evt: object) => push(evt), done: () => push(DONE), read };
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class AgentChatService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    private readonly secretsService: SecretsService,
    private readonly executionsService: ExecutionsService,
    private readonly memoryService: MemoryService,
    private readonly checkpointerService: CheckpointerService,
  ) {}

  async *chat(workspaceId: string, dto: ChatDto): AsyncIterable<object> {
    const threadId = dto.threadId ?? `agent-chat-${workspaceId}-${Date.now()}`;

    // Load workspace API keys (fall back to server env vars)
    const [anthropicKey, openaiKey, groqKey, googleKey, xaiKey, sessionMemory] = await Promise.all([
      this.memoryService.loadApiKey(workspaceId, 'anthropic'),
      this.memoryService.loadApiKey(workspaceId, 'openai'),
      this.memoryService.loadApiKey(workspaceId, 'groq'),
      this.memoryService.loadApiKey(workspaceId, 'google'),
      this.memoryService.loadApiKey(workspaceId, 'xai'),
      this.memoryService.loadForExecution(workspaceId, undefined, threadId),
    ]);

    const apiKeys: ModelApiKeys = {
      ANTHROPIC_API_KEY: anthropicKey ?? this.config.get<string>('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: openaiKey ?? this.config.get<string>('OPENAI_API_KEY'),
      GROQ_API_KEY: groqKey ?? this.config.get<string>('GROQ_API_KEY'),
      GOOGLE_API_KEY: googleKey ?? this.config.get<string>('GOOGLE_API_KEY'),
      XAI_API_KEY: xaiKey ?? this.config.get<string>('XAI_API_KEY'),
    };

    // Resolve model — validate provider key is available
    let modelDef = dto.model ? MODEL_REGISTRY[dto.model] : null;
    modelDef ??= MODEL_REGISTRY['claude-sonnet-4-6'];

    const requiredKey = PROVIDER_KEY_MAP[modelDef.provider];
    if (requiredKey && !apiKeys[requiredKey] && modelDef.provider !== 'ollama') {
      const fallback = Object.values(MODEL_REGISTRY)
        .filter((m) => !m.useCases.includes('embedding') && (
          m.provider === 'ollama' ||
          (PROVIDER_KEY_MAP[m.provider] != null && apiKeys[PROVIDER_KEY_MAP[m.provider]!] != null)
        ))
        .sort((a, b) => a.costPer1mTokens.input - b.costPer1mTokens.input)[0];
      if (fallback) modelDef = fallback;
    }

    // Inject session memory into system prompt when available
    const memorySection =
      sessionMemory && Object.keys(sessionMemory).length > 0
        ? '\n\n## What you remember about this user\n' +
          Object.entries(sessionMemory)
            .map(([k, v]) => `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
            .join('\n')
        : '';

    const system =
      SYSTEM_PROMPT +
      memorySection +
      (dto.context?.podId
        ? `\n\nActive pod: ${dto.context.podId}${dto.context.podName ? ` (${dto.context.podName})` : ''}`
        : '');

    const client = createModelClient(modelDef.id, modelDef.provider, apiKeys);

    const initialMessages: ModelChatMessage[] = [
      { role: 'system', content: system },
      ...dto.messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    // Build async event channel — nodes push events, generator yields them
    const channel = createEventChannel();
    const self = this;

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('callModel', async (state: AgentStateType, config: any) => {
        const { _emit, _client } = config.configurable as {
          _emit: typeof channel.emit;
          _client: ModelClient;
        };

        const result = await _client(state.messages, {
          maxTokens: 4096,
          tools: AGENT_TOOLS,
          toolChoice: 'auto',
          onToken: (delta: string) => _emit({ type: 'text_delta', delta }),
        });

        if (result.toolCalls?.length && result.stopReason === 'tool_use') {
          return {
            messages: [{ role: 'assistant' as const, content: result.text, toolCalls: result.toolCalls }],
            pendingTools: result.toolCalls,
          };
        }

        return {
          messages: [{ role: 'assistant' as const, content: result.text }],
          pendingTools: null,
        };
      })
      .addNode('callTools', async (state: AgentStateType, config: any) => {
        const { _emit, _workspaceId, _dto, _threadId } = config.configurable as {
          _emit: typeof channel.emit;
          _workspaceId: string;
          _dto: ChatDto;
          _threadId: string;
        };

        // Execute all tool calls in parallel — no interrupts in agent-chat
        const results = await Promise.all(
          (state.pendingTools ?? []).map(async (tc) => {
            _emit({ type: 'step_start', id: tc.id, name: tc.name });
            _emit({ type: 'tool_call', id: tc.id, name: tc.name, input: tc.arguments });
            const result = await self.executeTool(_workspaceId, _threadId, tc.name, tc.arguments, _dto);
            _emit({ type: 'tool_result', id: tc.id, name: tc.name, result });
            return { tc, result };
          }),
        );

        const newMsgs: ModelChatMessage[] = results.map(({ tc, result }) => ({
          role: 'tool' as const,
          content: JSON.stringify(result),
          toolCallId: tc.id,
        }));

        return { messages: newMsgs, pendingTools: null };
      })
      .addEdge(START, 'callModel' as any)
      .addConditionalEdges('callModel' as any, (state: AgentStateType) =>
        (state.pendingTools?.length ?? 0) > 0 ? 'callTools' : END,
      )
      .addEdge('callTools' as any, 'callModel' as any)
      .compile({ checkpointer: this.checkpointerService.checkpointer });

    graph
      .invoke(
        { messages: initialMessages, pendingTools: null },
        {
          configurable: {
            thread_id: threadId,
            _emit: channel.emit,
            _client: client,
            _workspaceId: workspaceId,
            _dto: dto,
            _threadId: threadId,
          },
        },
      )
      .then(() => channel.done())
      .catch((err: unknown) => {
        channel.emit({ type: 'error', error: err instanceof Error ? err.message : String(err) });
        channel.done();
      });

    for await (const evt of channel.read()) {
      yield evt;
    }

    yield { type: 'done' };
  }

  private async executeTool(
    workspaceId: string,
    threadId: string,
    name: string,
    input: Record<string, unknown>,
    dto: ChatDto,
  ): Promise<unknown> {
    switch (name) {
      case 'check_workspace_secrets': {
        const rows = await this.secretsService.findAll(workspaceId);
        if (rows.length === 0) return { configured: [], message: 'No secrets configured yet.' };
        return { configured: rows.map((r) => r.name) };
      }

      case 'list_pods': {
        const rows = await this.db
          .select({ id: pods.id, name: pods.name, description: pods.description })
          .from(pods)
          .where(eq(pods.workspaceId, workspaceId));
        return { pods: rows };
      }

      case 'list_workflows': {
        const podId = input['pod_id'] as string;
        const rows = await this.db
          .select({ id: workflows.id, name: workflows.name, description: workflows.description, isPublic: workflows.isPublic })
          .from(workflows)
          .where(eq(workflows.podId, podId));
        return { workflows: rows };
      }

      case 'create_workflow': {
        const podId = input['pod_id'] as string;
        const wfName = input['name'] as string;
        const description = (input['description'] as string | undefined) ?? null;
        const definition = input['definition'] as { nodes: unknown[]; edges: unknown[] };

        const [created] = await this.db
          .insert(workflows)
          .values({ podId, name: wfName, description, definition: definition as any })
          .returning({ id: workflows.id, name: workflows.name });

        return { success: true, workflowId: created?.id, name: created?.name };
      }

      case 'run_workflow': {
        const podId = input['pod_id'] as string;
        const wfId = input['workflow_id'] as string;
        const wfInput = (input['input'] as Record<string, unknown>) ?? {};

        const [pod] = await this.db
          .select({ workspaceId: pods.workspaceId })
          .from(pods)
          .where(eq(pods.id, podId))
          .limit(1);
        const resolvedWorkspaceId = pod?.workspaceId ?? workspaceId;

        let ex: { id: string; status: string };
        try {
          ex = await this.executionsService.createFromTrigger(podId, resolvedWorkspaceId, wfId, 'sdk', wfInput);
        } catch (err) {
          return { error: err instanceof Error ? err.message : 'Failed to start execution' };
        }

        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          await new Promise<void>((r) => setTimeout(r, 2_000));
          const current = await this.executionsService.findOne(podId, ex.id);
          if (current.status === 'completed')
            return { success: true, executionId: ex.id, output: (current.output as Record<string, unknown>)?.['result'] ?? current.output };
          if (current.status === 'failed')
            return { success: false, executionId: ex.id, error: current.error ?? 'Execution failed' };
          if (current.status === 'suspended')
            return { success: false, executionId: ex.id, error: 'Workflow paused waiting for human input — cannot complete from agent context' };
        }
        return { success: false, executionId: ex.id, error: 'Timed out after 60 seconds' };
      }

      case 'save_to_memory': {
        const key = input['key'] as string;
        const value = input['value'] as string;
        await this.memoryService.writeEntry(
          workspaceId,
          undefined,
          threadId,
          'thread',
          undefined,
          key,
          value,
        );
        return { success: true, key, message: `Remembered: ${key}` };
      }

      case 'list_executions': {
        const podId = input['pod_id'] as string;
        const workflowId = input['workflow_id'] as string | undefined;
        const limit = Math.min(Number(input['limit'] ?? 10), 50);

        const conditions = [eq(executions.podId, podId)];
        if (workflowId) conditions.push(eq(executions.workflowId, workflowId));

        const rows = await this.db
          .select({
            id: executions.id,
            status: executions.status,
            triggeredBy: executions.triggeredBy,
            startedAt: executions.startedAt,
            finishedAt: executions.finishedAt,
            workflowId: executions.workflowId,
          })
          .from(executions)
          .where(and(...conditions))
          .orderBy(desc(executions.createdAt))
          .limit(limit);

        return { executions: rows, count: rows.length };
      }

      case 'get_execution': {
        const podId = input['pod_id'] as string;
        const executionId = input['execution_id'] as string;
        try {
          const ex = await this.executionsService.findOne(podId, executionId);
          return {
            id: ex.id,
            status: ex.status,
            triggeredBy: ex.triggeredBy,
            startedAt: ex.startedAt,
            finishedAt: ex.finishedAt,
            error: ex.error,
            output: ex.output,
            nodeResults: ex.nodeResults,
          };
        } catch {
          return { error: `Execution ${executionId} not found in pod ${podId}` };
        }
      }

      case 'list_schedules': {
        const podId = input['pod_id'] as string;
        const rows = await this.db
          .select({
            id: schedules.id,
            workflowId: schedules.workflowId,
            cronExpr: schedules.cronExpr,
            enabled: schedules.enabled,
            lastRunAt: schedules.lastRunAt,
            nextRunAt: schedules.nextRunAt,
          })
          .from(schedules)
          .where(eq(schedules.podId, podId))
          .orderBy(schedules.nextRunAt);

        return { schedules: rows, count: rows.length };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  // ─── Session persistence ───────────────────────────────────────────────────

  async listSessions(workspaceId: string) {
    return this.db
      .select({
        id: agentChatSessions.id,
        threadId: agentChatSessions.threadId,
        title: agentChatSessions.title,
        createdAt: agentChatSessions.createdAt,
        updatedAt: agentChatSessions.updatedAt,
      })
      .from(agentChatSessions)
      .where(eq(agentChatSessions.workspaceId, workspaceId))
      .orderBy(desc(agentChatSessions.updatedAt))
      .limit(50);
  }

  async upsertSession(
    workspaceId: string,
    userId: string,
    threadId: string,
    title: string,
    messages: unknown[],
  ) {
    const [row] = await this.db
      .insert(agentChatSessions)
      .values({ workspaceId, userId, threadId, title, messages })
      .onConflictDoUpdate({
        target: agentChatSessions.threadId,
        set: { title, messages, updatedAt: new Date() },
      })
      .returning();
    return row;
  }

  async patchSession(
    workspaceId: string,
    sessionId: string,
    dto: { title?: string; messages?: unknown[] },
  ) {
    const [existing] = await this.db
      .select({ id: agentChatSessions.id })
      .from(agentChatSessions)
      .where(and(eq(agentChatSessions.id, sessionId), eq(agentChatSessions.workspaceId, workspaceId)))
      .limit(1);
    if (!existing) throw new NotFoundException('Session not found');

    const [row] = await this.db
      .update(agentChatSessions)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(agentChatSessions.id, sessionId))
      .returning();
    return row;
  }

  async deleteSession(workspaceId: string, sessionId: string) {
    await this.db
      .delete(agentChatSessions)
      .where(and(eq(agentChatSessions.id, sessionId), eq(agentChatSessions.workspaceId, workspaceId)));
  }
}
