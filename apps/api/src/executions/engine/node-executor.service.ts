import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isGraphInterrupt, interrupt } from '@langchain/langgraph';
import { ilike, and, eq, sql } from 'drizzle-orm';
import type { WorkflowState } from './variable-substitution';
import { substituteInValue } from './variable-substitution';
import { MODEL_REGISTRY } from './models/registry';
import { executeAgentNode } from './executors/agent.executor';
import type { LongTermMemoryContext } from './executors/agent.executor';
import { executeHTTPNode } from './executors/http.executor';
import { executeTransformNode } from './executors/transform.executor';
import { executeLogicNode } from './executors/logic.executor';
import { executeMcpNode } from './executors/mcp.executor';
import { executeMemoryNode } from './executors/memory.executor';
import type { MemoryExecutorContext } from './executors/memory.executor';
import { executeGuardrailsNode } from './executors/guardrails.executor';
import { executeExtractNode } from './executors/extract.executor';
import { executeRetrieverNode } from './executors/retriever.executor';
import { executeCodeNode } from './executors/code.executor';
import { executeLoopNode } from './executors/loop.executor';
import { executeSlackNode } from './executors/slack.executor';
import { executeGitHubNode } from './executors/github.executor';
import { executeNotionNode } from './executors/notion.executor';
import { executeGmailNode } from './executors/gmail.executor';
import { buildParallelResults } from './executors/parallel.executor';
import type { ParallelBranch } from './executors/parallel.executor';
import { executeWaitNode } from './executors/wait.executor';
import { executeVariablesNode } from './executors/variables.executor';
import { executeEvaluatorNode } from './executors/evaluator.executor';
import { executeFilterNode } from './executors/filter.executor';
import { executeMergeNode } from './executors/merge.executor';
import { executeDatetimeNode } from './executors/datetime.executor';
import { ExecutionSupervisor } from './supervisor';
import { MemoryService } from './memory.service';
import type { ModelApiKeys } from './models/client.factory';
import type { DrizzleDB } from '@linea/db';
import { knowledgeEntries } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';

export interface NodeInput {
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, any>;
  state: WorkflowState;
  workspaceId: string;
  workflowId?: string;
  threadId?: string;
  supervisorModelOverride?: string;
}

export interface NodeOutput {
  result: any;
  isAgentOutput: boolean;
}

// Default timeouts per node type (ms). Override per-node via nodeData.timeoutMs.
const DEFAULT_TIMEOUTS: Record<string, number> = {
  agent: 120_000,
  http: 30_000,
  transform: 5_000,
  'if-else': 1_000,
  router: 1_000,
  start: 2_000,
  end: 1_000,
  approval: 0,
  mcp: 30_000,
  memory: 5_000,
  guardrails: 5_000,
  extract: 60_000,
  retriever: 15_000,
  code: 10_000,
  loop: 30_000,
  parallel: 300_000,
  wait: 310_000,
  variables: 1_000,
  evaluator: 30_000,
  subworkflow: 120_000,
  slack: 15_000,
  github: 15_000,
  notion: 15_000,
  gmail: 15_000,
  filter: 5_000,
  merge: 5_000,
  datetime: 1_000,
  default: 60_000,
};

const MAX_RETRIES = 2;

@Injectable()
export class NodeExecutorService {
  private readonly logger = new Logger(NodeExecutorService.name);
  private readonly envApiKeys: ModelApiKeys;
  private readonly defaultAgentModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supervisor: ExecutionSupervisor,
    private readonly memoryService: MemoryService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {
    this.envApiKeys = {
      ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: config.get('OPENAI_API_KEY'),
      GROQ_API_KEY: config.get('GROQ_API_KEY'),
      GOOGLE_API_KEY: config.get('GOOGLE_API_KEY'),
      OLLAMA_BASE_URL: config.get('OLLAMA_BASE_URL'),
    };
    this.defaultAgentModel =
      config.get('DEFAULT_AGENT_MODEL') ?? 'claude-sonnet-4-6';
  }

  async execute(input: NodeInput): Promise<NodeOutput> {
    const { nodeId, nodeType, nodeData } = input;
    const timeoutMs =
      nodeData.timeoutMs ??
      DEFAULT_TIMEOUTS[nodeType] ??
      DEFAULT_TIMEOUTS['default'];
    const maxRetries = nodeData.maxRetries ?? MAX_RETRIES;

    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      const startedAt = Date.now();
      try {
        const result = await this.withTimeout(
          () => this.dispatch(input),
          timeoutMs,
          nodeId,
        );
        return result;
      } catch (err) {
        // LangGraph interrupt — must propagate to LangGraph's runner, not supervisor
        if (isGraphInterrupt(err)) throw err;

        lastError = err;
        const elapsed = Date.now() - startedAt;
        const isTimeout = err instanceof NodeTimeoutError;
        const errorMsg = err instanceof Error ? err.message : String(err);

        this.logger.warn(
          `Node ${nodeId} (${nodeType}) ${isTimeout ? 'timed out' : 'failed'} after ${elapsed}ms [attempt ${attempt + 1}]`,
        );

        // Ask supervisor whether to retry, skip, or abort
        // Skips this for deterministic nodes (transform, logic) — supervisor returns abort immediately
        const decision = await this.supervisor.assess({
          nodeId,
          nodeType,
          nodeName: nodeData.nodeName,
          error: isTimeout ? undefined : errorMsg,
          elapsedMs: elapsed,
          retryCount: attempt,
          maxRetries,
          state: { variables: input.state.variables },
        });

        this.logger.log(
          `Supervisor decision for ${nodeId}: ${decision.action} — ${decision.reason}`,
        );

        if (decision.action === 'skip') {
          return {
            result: { skipped: true, reason: decision.reason },
            isAgentOutput: false,
          };
        }

        if (decision.action === 'abort') {
          throw new Error(`Node ${nodeId} aborted: ${decision.reason}`);
        }

        if (decision.action === 'retry') {
          if (decision.retryDelayMs) await sleep(decision.retryDelayMs);
          attempt++;
          continue;
        }

        // 'continue' — treat as success with empty output (shouldn't happen for errors)
        return { result: { continued: true }, isAgentOutput: false };
      }
    }

    if (nodeData.continueOnFail) {
      const errorMsg = lastError instanceof Error ? lastError.message : String(lastError);
      this.logger.log(`Node ${nodeId} (${nodeType}) continuing on fail: ${errorMsg}`);
      return {
        result: { error: errorMsg, continued: true, continueOnFail: true },
        isAgentOutput: false,
      };
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error(`Node ${nodeId} failed after ${maxRetries} retries`);
  }

  private async dispatch({
    nodeId,
    nodeType,
    nodeData: rawNodeData,
    state,
    workspaceId,
    workflowId,
    threadId,
  }: NodeInput): Promise<NodeOutput> {
    const nodeData = substituteInValue(rawNodeData, state) as Record<
      string,
      any
    >;
    switch (nodeType) {
      case 'start': {
        let parsed = state.variables.input;
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            /* keep as string */
          }
        }
        const spread =
          typeof parsed === 'object' && parsed !== null
            ? parsed
            : { input: parsed };
        return {
          result: { message: 'Workflow started', ...spread },
          isAgentOutput: false,
        };
      }

      case 'end':
        return {
          result: {
            message: 'Workflow completed',
            finalOutput: state.variables.lastOutput,
          },
          isAgentOutput: false,
        };

      case 'agent': {
        const data = { ...nodeData };
        if (!data.model) data.model = this.defaultAgentModel;
        const resolvedKeys = await this.resolveApiKeys(workspaceId);

        let ltmCtx: LongTermMemoryContext | undefined;
        if (threadId) {
          const openaiKey = resolvedKeys.OPENAI_API_KEY;
          ltmCtx = {
            workspaceId,
            workflowId,
            threadId,
            store: (key, value) =>
              this.memoryService.storeLongTermMemory(
                workspaceId,
                workflowId,
                threadId,
                key,
                value,
                openaiKey,
              ),
            search: (query, topK) =>
              this.memoryService.searchSemantic(
                workspaceId,
                workflowId,
                query,
                topK,
                openaiKey,
              ),
            loadRecent: (topK) =>
              this.memoryService.loadRecentForContext(
                workspaceId,
                workflowId,
                topK,
                threadId,
              ),
          };
        }

        const raw = await executeAgentNode(data, state, resolvedKeys, ltmCtx);
        return { result: raw, isAgentOutput: true };
      }

      case 'http':
      case 'http-request': {
        const r = await executeHTTPNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'transform':
      case 'data-transform': {
        const r = executeTransformNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'if-else':
      case 'if / else': {
        const r = executeLogicNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'router': {
        const r = executeLogicNode({ ...nodeData, nodeType: 'router' }, state);
        return { result: r, isAgentOutput: false };
      }

      case 'approval': {
        // Suspend execution; when resumed the interrupt() call returns the resume value
        const resumeValue = interrupt({
          type: 'approval',
          nodeId,
          message: nodeData.approvalMessage || nodeData.instructions || 'Approval required',
        });
        // resumeValue is { approved: boolean } from ApproveExecutionDto
        const approved = typeof resumeValue === 'object' && resumeValue !== null
          ? Boolean((resumeValue as Record<string, unknown>).approved)
          : true;
        return {
          result: {
            __approvalDecision: approved ? 'approved' : 'rejected',
            approved,
            message: nodeData.approvalMessage || 'Approval required',
          },
          isAgentOutput: false,
        };
      }

      case 'note':
        return { result: { skipped: true }, isAgentOutput: false };

      case 'mcp': {
        const mcpServerId = nodeData.mcpServerId as string | undefined;
        let serverUrl = nodeData.serverUrl as string | undefined;
        let accessToken: string | undefined;
        if (mcpServerId) {
          // Always load credentials from the encrypted mcp_servers store — never from node data
          const server = await this.memoryService.loadMcpServer(
            workspaceId,
            mcpServerId,
          );
          serverUrl = server?.url ?? serverUrl;
          accessToken = server?.accessToken;
        } else if (!serverUrl) {
          throw new Error('MCP node requires either mcpServerId or serverUrl');
        }
        // Never read accessToken from nodeData — it would be stored plaintext in the workflow definition
        const r = await executeMcpNode(nodeData, state, serverUrl, accessToken);
        return { result: r, isAgentOutput: false };
      }

      case 'memory': {
        const memCtx: MemoryExecutorContext | undefined = workspaceId
          ? { workspaceId, workflowId, threadId: threadId ?? '', service: this.memoryService }
          : undefined;
        const r = await executeMemoryNode(nodeData, state, memCtx);
        return { result: r, isAgentOutput: false };
      }

      case 'guardrails': {
        const r = executeGuardrailsNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'extract': {
        const firecrawlKey = this.config.get<string>('FIRECRAWL_API_KEY');
        const r = await executeExtractNode(nodeData, state, firecrawlKey);
        return { result: r, isAgentOutput: false };
      }

      case 'retriever': {
        const embModelId = (nodeData.embeddingModel as string | undefined) ?? 'text-embedding-3-small';
        const modelDef = MODEL_REGISTRY[embModelId];
        const provider = modelDef?.provider ?? 'openai';

        // Load workspace API key for the selected embedding model's provider
        const embApiKey = provider !== 'ollama'
          ? await this.memoryService.loadApiKey(workspaceId, provider)
          : undefined;

        // Generate query embedding using the selected model
        const rawQuery = (nodeData.query as string | undefined) ?? String(state.variables['lastOutput'] ?? '');
        const resolvedQuery = substituteInValue(rawQuery, state) as string;
        const queryEmbedding = await this.memoryService.generateEmbedding(resolvedQuery, embApiKey, embModelId);

        const r = await executeRetrieverNode(nodeData, state, {
          query: async (q, kbId, topK) => {
            if (queryEmbedding) {
              try {
                const embLiteral = `[${queryEmbedding.join(',')}]`;
                const rows = await this.db.execute(sql`
                  SELECT content, metadata
                  FROM knowledge_entries
                  WHERE knowledge_base_id = ${kbId} AND embedding IS NOT NULL
                  ORDER BY embedding <=> ${embLiteral}::vector
                  LIMIT ${topK}
                `);
                const results = Array.from(rows) as Array<{ content: string; metadata: unknown }>;
                if (results.length > 0) return results;
              } catch {
                /* pgvector unavailable — fall through to text search */
              }
            }
            // Text search fallback
            return this.db
              .select({ content: knowledgeEntries.content, metadata: knowledgeEntries.metadata })
              .from(knowledgeEntries)
              .where(and(eq(knowledgeEntries.knowledgeBaseId, kbId), ilike(knowledgeEntries.content, `%${q}%`)))
              .limit(topK);
          },
        });
        return { result: r, isAgentOutput: false };
      }

      case 'code': {
        const r = executeCodeNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'loop': {
        const r = executeLoopNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'parallel': {
        const branches = (nodeData.branches ?? []) as ParallelBranch[];
        const failFast = Boolean(nodeData.failFast);
        if (branches.length === 0) {
          return { result: { results: [], count: 0, failed: 0 }, isAgentOutput: false };
        }
        const settled = await Promise.allSettled(
          branches.map((branch) =>
            this.dispatch({
              nodeId: `${nodeId}__${branch.id}`,
              nodeType: branch.type,
              nodeData: branch.config ?? {},
              state,
              workspaceId,
              workflowId,
              threadId,
            }),
          ),
        );
        if (failFast) {
          const firstFailure = settled.find((s) => s.status === 'rejected');
          if (firstFailure) throw (firstFailure as PromiseRejectedResult).reason;
        }
        const r = buildParallelResults(branches, settled);
        return { result: r, isAgentOutput: false };
      }

      case 'wait': {
        const r = await executeWaitNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'variables': {
        const r = executeVariablesNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'evaluator': {
        const anthropicKey = this.config.get<string>('ANTHROPIC_API_KEY');
        const r = await executeEvaluatorNode(nodeData, state, anthropicKey);
        return { result: r, isAgentOutput: false };
      }

      case 'slack': {
        const slackToken = await this.memoryService.resolveIntegrationToken(
          workspaceId, 'slack', 'SLACK_TOKEN',
        );
        const r = await executeSlackNode(nodeData, state, slackToken);
        return { result: r, isAgentOutput: false };
      }

      case 'github': {
        const ghToken = await this.memoryService.resolveIntegrationToken(
          workspaceId, 'github', 'GITHUB_TOKEN',
        );
        const r = await executeGitHubNode(nodeData, state, ghToken);
        return { result: r, isAgentOutput: false };
      }

      case 'notion': {
        const notionToken = await this.memoryService.resolveIntegrationToken(
          workspaceId, 'notion', 'NOTION_TOKEN',
        );
        const r = await executeNotionNode(nodeData, state, notionToken);
        return { result: r, isAgentOutput: false };
      }

      case 'gmail': {
        const gmailToken = await this.memoryService.resolveIntegrationToken(
          workspaceId, 'google', 'GMAIL_TOKEN',
        );
        const r = await executeGmailNode(nodeData, state, gmailToken);
        return { result: r, isAgentOutput: false };
      }

      case 'filter': {
        const r = executeFilterNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'merge': {
        const r = executeMergeNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'datetime': {
        const r = executeDatetimeNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      default:
        return {
          result: {
            message: `Node type '${nodeType}' is not yet implemented`,
            nodeType,
          },
          isAgentOutput: false,
        };
    }
  }

  private async resolveApiKeys(workspaceId: string): Promise<ModelApiKeys> {
    const PROVIDERS = [
      { key: 'ANTHROPIC_API_KEY', provider: 'anthropic' },
      { key: 'OPENAI_API_KEY', provider: 'openai' },
      { key: 'GROQ_API_KEY', provider: 'groq' },
      { key: 'GOOGLE_API_KEY', provider: 'google' },
    ] as const;

    const resolved: ModelApiKeys = { ...this.envApiKeys };

    await Promise.all(
      PROVIDERS.map(async ({ key, provider }) => {
        const dbKey = await this.memoryService.loadApiKey(workspaceId, provider);
        if (dbKey) resolved[key] = dbKey;
      }),
    );

    // Ollama base URL from secrets table (users can set it per-workspace)
    const ollamaUrl = await this.memoryService.loadSecret(workspaceId, 'OLLAMA_BASE_URL');
    if (ollamaUrl) resolved.OLLAMA_BASE_URL = ollamaUrl;

    return resolved;
  }

  private withTimeout<T>(
    fn: () => Promise<T>,
    ms: number,
    nodeId: string,
  ): Promise<T> {
    if (ms <= 0) return fn(); // 0 = unlimited

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new NodeTimeoutError(`Node ${nodeId} exceeded ${ms}ms timeout`),
          ),
        ms,
      );
      fn().then(
        (val) => {
          clearTimeout(timer);
          resolve(val);
        },
        (err: unknown) => {
          clearTimeout(timer);
          reject(err instanceof Error ? err : new Error(String(err)));
        },
      );
    });
  }
}

class NodeTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeTimeoutError';
  }
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
