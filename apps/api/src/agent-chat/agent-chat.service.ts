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
import { DB_TOKEN } from '../database/database.module.js';
import { SecretsService } from '../secrets/secrets.service.js';
import { ExecutionsService } from '../executions/executions.service.js';
import { MemoryService } from '../executions/engine/memory.service.js';
import { CheckpointerService } from '../executions/engine/checkpointer.service.js';
import { McpService } from '../mcp/mcp.service.js';
import type {
  ChatMessage as ModelChatMessage,
  NormalizedToolCall,
} from '../services/ai/types.js';
import { SYSTEM_PROMPT, AGENT_TOOLS } from './agent-chat.prompt.js';
import type { ChatDto } from './dto/chat.dto.js';
import { AIService } from '../services/ai/ai.service.js';
import { createEventChannel, EventChannel } from './event.channel.js';
import { AgentContext, AgentEvent } from './types.js';
import { PinoLogger } from 'nestjs-pino';

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
    } catch (_) {
      throw new Error('Failed to prepare system prompt');
    }
  }

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
