import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import {
  StateGraph,
  Annotation,
  START,
  END,
  LangGraphRunnableConfig,
} from '@langchain/langgraph';
import type { DrizzleDB } from '@linea/db';
import {
  pods,
  workflows,
  executions,
  schedules,
  agentChatSessions,
} from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { SecretsService } from '../secrets/secrets.service';
import { ExecutionsService } from '../executions/executions.service';
import { MemoryService } from '../executions/engine/memory.service';
import { CheckpointerService } from '../executions/engine/checkpointer.service';
import { McpService } from '../mcp/mcp.service';
import type {
  ChatMessage as ModelChatMessage,
  NormalizedToolCall,
} from '../executions/engine/models/client.factory';
import type { ToolDefinition } from '../executions/engine/tools/definitions';
import type { ChatDto } from './dto/chat.dto';
import { AIService } from 'src/services/ai/ai.service';
import { createEventChannel, EventChannel } from './event.channel';
import { AgentContext, AgentEvent } from './types';
import { PinoLogger } from 'nestjs-pino';

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
10. Use list_mcp_servers / call_mcp_tool to interact with any MCP server configured in the workspace

Be direct, clear, and structured. Use emoji section headers for readability.`;

const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: 'check_workspace_secrets',
    description:
      'Check which API keys and secrets are configured in this workspace. Returns secret names (not values).',
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
      properties: {
        pod_id: {
          type: 'string',
          description: 'The pod ID to list workflows for',
        },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'create_workflow',
    description:
      'Create a new workflow in a pod. Provide a complete node/edge definition.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID to create the workflow in',
        },
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
    description:
      'Trigger a workflow execution and wait for its result (up to 60 seconds). For chatbot workflows pass input: { message: "..." }. Returns output on success, or an error.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID that owns the workflow',
        },
        workflow_id: { type: 'string', description: 'Workflow ID to execute' },
        input: {
          type: 'object',
          description: 'Input variables',
          properties: {},
          required: [],
        },
      },
      required: ['pod_id', 'workflow_id'],
    },
    approval: 'never',
  },
  {
    name: 'save_to_memory',
    description:
      'Persist a piece of information so you can recall it in future conversations with this user. Use for names, preferences, context, or any fact worth remembering long-term.',
    parameters: {
      type: 'object',
      properties: {
        key: {
          type: 'string',
          description:
            'Short descriptive key, e.g. "user_name" or "preferred_language"',
        },
        value: { type: 'string', description: 'The information to remember' },
      },
      required: ['key', 'value'],
    },
    approval: 'never',
  },
  {
    name: 'list_executions',
    description:
      'List recent executions for a pod, optionally filtered by workflow. Returns id, status, triggeredBy, startedAt, finishedAt.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID to list executions for',
        },
        workflow_id: {
          type: 'string',
          description: 'Optional: filter by workflow ID',
        },
        limit: {
          type: 'number',
          description: 'Max results (default 10, max 50)',
        },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'get_execution',
    description:
      'Get details of a specific execution — status, output, error, node results.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: {
          type: 'string',
          description: 'Pod ID that owns the execution',
        },
        execution_id: { type: 'string', description: 'Execution ID' },
      },
      required: ['pod_id', 'execution_id'],
    },
    approval: 'never',
  },
  {
    name: 'list_schedules',
    description:
      'List scheduled triggers for a pod — cron expression, enabled state, last and next run times.',
    parameters: {
      type: 'object',
      properties: {
        pod_id: { type: 'string', description: 'Pod ID to list schedules for' },
      },
      required: ['pod_id'],
    },
    approval: 'never',
  },
  {
    name: 'list_mcp_servers',
    description:
      'List all MCP (Model Context Protocol) servers configured in this workspace. Returns id, name, and url for each server.',
    parameters: { type: 'object', properties: {}, required: [] },
    approval: 'never',
  },
  {
    name: 'call_mcp_tool',
    description:
      'Call a tool on a configured MCP server. First use list_mcp_servers to find available servers, then call a specific tool with parameters.',
    parameters: {
      type: 'object',
      properties: {
        server_id: {
          type: 'string',
          description: 'MCP server ID (from list_mcp_servers)',
        },
        tool_name: {
          type: 'string',
          description: 'Name of the tool to call on the MCP server',
        },
        parameters: {
          type: 'object',
          description: 'Tool parameters as key-value pairs',
        },
      },
      required: ['server_id', 'tool_name'],
    },
    approval: 'never',
  },
];

const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<ModelChatMessage[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),
  pendingTools: Annotation<NormalizedToolCall[] | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
});

type AgentStateType = typeof AgentStateAnnotation.State;

@Injectable()
export class AgentChatService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly ai: AIService,
    private readonly secretsService: SecretsService,
    private readonly executionsService: ExecutionsService,
    private readonly memoryService: MemoryService,
    private readonly checkpointerService: CheckpointerService,
    private readonly mcpService: McpService,
    private readonly logger: PinoLogger,
  ) {}

  async *chat(workspaceId: string, dto: ChatDto): AsyncIterable<AgentEvent> {
    const threadId = dto.threadId ?? `agent-chat-${workspaceId}-${Date.now()}`;

    const initialMessages: ModelChatMessage[] = dto.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const client = await this.ai.initialize(workspaceId, dto.provider);
    const system = await this.prepareSystemPrompt(workspaceId, threadId, dto);
    const channel = createEventChannel<AgentEvent>();

    const context: AgentContext = {
      workspaceId,
      threadId,
      dto,
      model: dto.model,
      system,
      client,
      emit: channel.emit.bind(channel),
    };

    const graph = this.createGraph();

    void this.runGraph(graph, context, initialMessages, channel);

    for await (const event of channel.read()) {
      yield event;
    }

    yield {
      type: 'done',
    };
  }

  private createGraph() {
    return new StateGraph(AgentStateAnnotation)
      .addNode('callModel', this.createModelNode())
      .addNode('callTools', this.createToolNode())
      .addEdge(START, 'callModel')
      .addConditionalEdges('callModel', (state) =>
        state.pendingTools?.length ? 'callTools' : END,
      )
      .addEdge('callTools', 'callModel')
      .compile({
        checkpointer: this.checkpointerService.checkpointer,
      });
  }

  private async runGraph(
    graph: ReturnType<typeof this.createGraph>,
    context: AgentContext,
    messages: ModelChatMessage[],
    channel: EventChannel<AgentEvent>,
  ) {
    try {
      await graph.invoke(
        { messages, pendingTools: null },
        {
          configurable: { thread_id: context.threadId, context },
        },
      );
    } catch (e) {
      channel.emit({
        type: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      channel.done();
    }
  }

  private createModelNode() {
    return async (state: AgentStateType, config: LangGraphRunnableConfig) => {
      const ctx = config.configurable?.context as AgentContext;
      const result = await ctx.client.chat(ctx.model, {
        messages: state.messages,
        maxTokens: 4096,
        tools: AGENT_TOOLS,
        toolChoice: 'auto',
        system: ctx.system,
        onToken: (delta) => {
          this.logger.warn(config.configurable);
          this.logger.warn(ctx);
          this.logger.warn(typeof ctx.emit);
          ctx.emit({ type: 'text_delta', delta });
        },
      });

      if (result.toolCalls?.length && result.stopReason === 'tool_use') {
        return {
          messages: [
            {
              role: 'assistant' as const,
              content: result.text,
              toolCalls: result.toolCalls,
            },
          ],
          pendingTools: result.toolCalls,
        };
      }

      return {
        messages: [{ role: 'assistant' as const, content: result.text }],
        pendingTools: null,
      };
    };
  }

  private createToolNode() {
    return async (state: AgentStateType, config: LangGraphRunnableConfig) => {
      const ctx = config.configurable?.context as AgentContext;
      const results = await Promise.all(
        (state.pendingTools ?? []).map(async (tc) => {
          ctx.emit({ type: 'step_start', id: tc.id, name: tc.name });
          ctx.emit({
            type: 'tool_call',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
          const result = await this.executeTool(
            ctx.workspaceId,
            ctx.threadId,
            tc.name,
            tc.arguments,
            ctx.dto,
          );
          ctx.emit({ type: 'tool_result', id: tc.id, name: tc.name, result });
          return { tc, result };
        }),
      );

      const newMsgs: ModelChatMessage[] = results.map(({ tc, result }) => ({
        role: 'tool' as const,
        content: JSON.stringify(result),
        toolCallId: tc.id,
      }));

      return { messages: newMsgs, pendingTools: null };
    };
  }

  private async executeTool(
    workspaceId: string,
    threadId: string,
    name: string,
    input: Record<string, unknown>,
    dto: ChatDto,
  ): Promise<unknown> {
    try {
      return await this.runTool(workspaceId, threadId, name, input, dto);
    } catch (err) {
      this.logger.error(err);
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  private async runTool(
    workspaceId: string,
    threadId: string,
    name: string,
    input: Record<string, unknown>,
    _dto: ChatDto,
  ): Promise<unknown> {
    switch (name) {
      case 'check_workspace_secrets': {
        const rows = await this.secretsService.findAll(workspaceId);
        if (rows.length === 0)
          return { configured: [], message: 'No secrets configured yet.' };
        return { configured: rows.map((r) => r.name) };
      }

      case 'list_pods': {
        const rows = await this.db
          .select({
            id: pods.id,
            name: pods.name,
            description: pods.description,
          })
          .from(pods)
          .where(eq(pods.workspaceId, workspaceId));
        return { pods: rows };
      }

      case 'list_workflows': {
        const podId = input['pod_id'] as string;
        const rows = await this.db
          .select({
            id: workflows.id,
            name: workflows.name,
            description: workflows.description,
            isPublic: workflows.isPublic,
          })
          .from(workflows)
          .innerJoin(pods, eq(pods.id, workflows.podId))
          .where(
            and(eq(workflows.podId, podId), eq(pods.workspaceId, workspaceId)),
          );
        return { workflows: rows };
      }

      case 'create_workflow': {
        const podId = input['pod_id'] as string;
        const wfName = input['name'] as string;
        const description =
          (input['description'] as string | undefined) ?? null;
        const definition = input['definition'] as {
          nodes: unknown[];
          edges: unknown[];
        };

        // Verify pod belongs to this workspace
        const [podCheck] = await this.db
          .select({ id: pods.id })
          .from(pods)
          .where(and(eq(pods.id, podId), eq(pods.workspaceId, workspaceId)))
          .limit(1);
        if (!podCheck)
          return { error: `Pod ${podId} not found in this workspace` };

        const [created] = await this.db
          .insert(workflows)
          .values({
            podId,
            name: wfName,
            description,
            definition: definition as any,
          })
          .returning({ id: workflows.id, name: workflows.name });

        return { success: true, workflowId: created?.id, name: created?.name };
      }

      case 'run_workflow': {
        const podId = input['pod_id'] as string;
        const wfId = input['workflow_id'] as string;
        const wfInput = (input['input'] as Record<string, unknown>) ?? {};

        // Verify pod belongs to this workspace before executing
        const [pod] = await this.db
          .select({ workspaceId: pods.workspaceId })
          .from(pods)
          .where(and(eq(pods.id, podId), eq(pods.workspaceId, workspaceId)))
          .limit(1);
        if (!pod) return { error: `Pod ${podId} not found in this workspace` };
        const resolvedWorkspaceId = workspaceId;

        let ex: { id: string; status: string };
        try {
          ex = await this.executionsService.createFromTrigger(
            podId,
            resolvedWorkspaceId,
            wfId,
            'sdk',
            wfInput,
          );
        } catch (err) {
          return {
            error:
              err instanceof Error ? err.message : 'Failed to start execution',
          };
        }

        const deadline = Date.now() + 60_000;
        while (Date.now() < deadline) {
          await new Promise<void>((r) => setTimeout(r, 2_000));
          const current = await this.executionsService.findOne(podId, ex.id);
          if (current.status === 'completed')
            return {
              success: true,
              executionId: ex.id,
              output:
                (current.output as Record<string, unknown>)?.['result'] ??
                current.output,
            };
          if (current.status === 'failed')
            return {
              success: false,
              executionId: ex.id,
              error: current.error ?? 'Execution failed',
            };
          if (current.status === 'suspended')
            return {
              success: false,
              executionId: ex.id,
              error:
                'Workflow paused waiting for human input — cannot complete from agent context',
            };
        }
        return {
          success: false,
          executionId: ex.id,
          error: 'Timed out after 60 seconds',
        };
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

        const conditions = [
          eq(executions.podId, podId),
          eq(executions.workspaceId, workspaceId),
        ];
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
        // Verify pod is in this workspace before fetching execution
        const [podOwner] = await this.db
          .select({ id: pods.id })
          .from(pods)
          .where(and(eq(pods.id, podId), eq(pods.workspaceId, workspaceId)))
          .limit(1);
        if (!podOwner) return { error: `Execution ${executionId} not found` };
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
          return {
            error: `Execution ${executionId} not found in pod ${podId}`,
          };
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
          .innerJoin(pods, eq(pods.id, schedules.podId))
          .where(
            and(eq(schedules.podId, podId), eq(pods.workspaceId, workspaceId)),
          )
          .orderBy(schedules.nextRunAt);

        return { schedules: rows, count: rows.length };
      }

      case 'list_mcp_servers': {
        const servers = await this.mcpService.findAll(workspaceId);
        return {
          servers: servers.map((s) => ({
            id: s.id,
            name: s.name,
            url: s.url,
            hasToken: s.hasToken,
          })),
          count: servers.length,
        };
      }

      case 'call_mcp_tool': {
        const serverId = input['server_id'] as string;
        const toolName = input['tool_name'] as string;
        const params = (input['parameters'] as Record<string, unknown>) ?? {};

        let serverInfo: { url: string; accessToken: string | null };
        try {
          serverInfo = await this.mcpService.getServerForCall(
            workspaceId,
            serverId,
          );
        } catch {
          return {
            error: `MCP server ${serverId} not found in this workspace`,
          };
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (serverInfo.accessToken)
          headers['Authorization'] = `Bearer ${serverInfo.accessToken}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30_000);

        try {
          const res = await fetch(serverInfo.url, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'tools/call',
              params: { name: toolName, arguments: params },
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text();
            return {
              error: `MCP server returned ${res.status}: ${text.slice(0, 200)}`,
            };
          }

          const json = (await res.json()) as {
            result?: unknown;
            error?: { message: string };
          };
          if (json.error)
            return { error: `MCP tool error: ${json.error.message}` };
          return { success: true, result: json.result };
        } catch (err) {
          return {
            error: err instanceof Error ? err.message : 'MCP call failed',
          };
        } finally {
          clearTimeout(timer);
        }
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  }

  private async prepareSystemPrompt(
    workspaceId: string,
    threadId: string,
    dto: ChatDto,
  ) {
    try {
      const sessionMemory = await this.memoryService.loadForExecution(
        workspaceId,
        undefined,
        threadId,
      );

      const memorySection =
        Object.keys(sessionMemory).length > 0
          ? '\n\n## What you remember about this user\n' +
            Object.entries(sessionMemory)
              .map(
                ([k, v]) =>
                  `- ${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
              )
              .join('\n')
          : '';

      const system =
        SYSTEM_PROMPT +
        memorySection +
        (dto.context?.podId
          ? `\n\nActive pod: ${dto.context.podId}${dto.context.podName ? ` (${dto.context.podName})` : ''}`
          : '');

      return system;
    } catch (error) {
      throw new Error('Failed to prepare system prompt');
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
      .where(
        and(
          eq(agentChatSessions.id, sessionId),
          eq(agentChatSessions.workspaceId, workspaceId),
        ),
      )
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
      .where(
        and(
          eq(agentChatSessions.id, sessionId),
          eq(agentChatSessions.workspaceId, workspaceId),
        ),
      );
  }
}
