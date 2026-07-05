import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isGraphInterrupt, interrupt } from '@langchain/langgraph';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { WorkflowState } from './variable-substitution.js';
import { substituteInValue } from './variable-substitution.js';
import { executeAgentNode } from './executors/agent.executor.js';
import type { LongTermMemoryContext } from './executors/agent.executor.js';
import { executeHTTPNode } from './executors/http.executor.js';
import { executeTransformNode } from './executors/transform.executor.js';
import { executeLogicNode } from './executors/logic.executor.js';
import { executeMcpNode } from './executors/mcp.executor.js';
import { executeMemoryNode } from './executors/memory.executor.js';
import type { MemoryExecutorContext } from './executors/memory.executor.js';
import { executeGuardrailsNode } from './executors/guardrails.executor.js';
import { executeExtractNode } from './executors/extract.executor.js';
import { executeRetrieverNode } from './executors/retriever.executor.js';
import { executeCodeNode } from './executors/code.executor.js';
import { executeLoopNode } from './executors/loop.executor.js';
import { executeSlackNode } from './executors/slack.executor.js';
import { executeGitHubNode } from './executors/github.executor.js';
import { executeNotionNode } from './executors/notion.executor.js';
import { executeGmailNode } from './executors/gmail.executor.js';
import { buildParallelResults } from './executors/parallel.executor.js';
import type { ParallelBranch } from './executors/parallel.executor.js';
import { executeWaitNode } from './executors/wait.executor.js';
import { executeVariablesNode } from './executors/variables.executor.js';
import { executeEvaluatorNode } from './executors/evaluator.executor.js';
import { executeFilterNode } from './executors/filter.executor.js';
import { executeMergeNode } from './executors/merge.executor.js';
import { executeDatetimeNode } from './executors/datetime.executor.js';
import { ExecutionSupervisor } from './supervisor.js';
import { MemoryService } from './memory.service.js';
import { AIService } from '../../services/ai/ai.service.js';
import type { DrizzleDB, WorkspaceSettings } from '@linea/db';
import { knowledgeBases, knowledgeEntries, workspaces } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module.js';

export interface NodeInput {
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, any>;
  state: WorkflowState;
  workspaceId: string;
  workflowId?: string;
  threadId?: string;
  supervisorModelOverride?: string;
  onToken?: (delta: string) => void;
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
  'approval-gate': 0,
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
  private readonly defaultAgentModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly supervisor: ExecutionSupervisor,
    private readonly memoryService: MemoryService,
    private readonly aiService: AIService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {
    this.defaultAgentModel =
      config.get('DEFAULT_AGENT_MODEL') ?? 'claude-sonnet-4-6';
    if (!config.get('SUPERVISOR_MODEL')) {
      this.logger.warn(
        'SUPERVISOR_MODEL env var is not set. Workspaces without a saved supervisor model in Settings → Model Preferences will abort on every node failure instead of retrying.',
      );
    }
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
    let resolvedSupervisorModel: string | undefined;
    let supervisorModelResolved = false;

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
          `Node ${nodeId} (${nodeType}) ${isTimeout ? 'timed out' : 'failed'} after ${elapsed}ms [attempt ${attempt + 1}]: ${errorMsg}`,
        );

        // Resolve workspace supervisor model once on first failure
        if (!supervisorModelResolved) {
          resolvedSupervisorModel = await this.resolveWorkspaceSupervisorModel(
            input.workspaceId,
          );
          supervisorModelResolved = true;
        }

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
          workspaceId: input.workspaceId,
          workspaceSupervisorModel: resolvedSupervisorModel,
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
          const label = (nodeData.nodeName as string | undefined) ?? nodeId;
          throw new Error(`"${label}" failed: ${decision.reason}`);
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
      const errorMsg =
        lastError instanceof Error ? lastError.message : String(lastError);
      this.logger.log(
        `Node ${nodeId} (${nodeType}) continuing on fail: ${errorMsg}`,
      );
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
    onToken,
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

        let ltmCtx: LongTermMemoryContext | undefined;
        if (threadId) {
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
                this.aiService,
              ),
            search: (query, topK) =>
              this.memoryService.searchSemantic(
                workspaceId,
                workflowId,
                query,
                topK,
                this.aiService,
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

        const raw = await executeAgentNode(
          data,
          state,
          this.aiService,
          workspaceId,
          ltmCtx,
          onToken,
        );
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

      case 'approval-gate': // backward-compat alias for old cloned workflows
      case 'approval': {
        // Suspend execution; when resumed the interrupt() call returns the resume value
        const resumeValue = interrupt({
          type: 'approval',
          nodeId,
          message:
            nodeData.approvalMessage ||
            nodeData.message ||
            nodeData.instructions ||
            'Approval required',
        });
        // resumeValue is { approved: boolean } from ApproveExecutionDto
        const approved =
          typeof resumeValue === 'object' && resumeValue !== null
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
          ? {
              workspaceId,
              workflowId,
              threadId: threadId ?? '',
              service: this.memoryService,
            }
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
        const embModelId =
          (nodeData.embeddingModel as string | undefined) ??
          'text-embedding-3-small';

        const rawQuery =
          (nodeData.query as string | undefined) ??
          String(state.variables['lastOutput'] ?? '');
        const resolvedQuery = substituteInValue(rawQuery, state) as string;
        const queryEmbedding = await this.memoryService.generateEmbedding(
          this.aiService,
          workspaceId,
          resolvedQuery,
          embModelId,
        );

        const wsSettings = await this.loadWorkspaceSettings(workspaceId);

        const r = await executeRetrieverNode(nodeData, state, {
          query: async (q, kbId, topK) => {
            //   nodeData.[setting] → kbSettings.[setting] → wsSettings → system default
            const [kbRow] = await this.db
              .select({ settings: knowledgeBases.settings })
              .from(knowledgeBases)
              .where(eq(knowledgeBases.id, kbId))
              .limit(1);
            const kbSettings = kbRow?.settings ?? {};

            const similarityThreshold =
              (nodeData.similarityThreshold as number | undefined) ??
              kbSettings.similarityThreshold ??
              wsSettings.ragSimilarityThreshold ??
              0.75;
            const distanceThreshold = 1 - similarityThreshold;

            const expandContext =
              (nodeData.expandContext as boolean | undefined) ??
              kbSettings.expandContext ??
              false;
            const enableRerank =
              (nodeData.enableRerank as boolean | undefined) ??
              kbSettings.enableRerank ??
              false;
            const rerankTopK =
              (nodeData.rerankTopK as number | undefined) ??
              kbSettings.rerankTopK ??
              50;
            const candidateK = enableRerank ? rerankTopK : topK * 3;

            type RagHit = {
              id: string;
              content: string;
              metadata: Record<string, unknown>;
              sourceId: string | null;
              chunkIndex: number | null;
            };

            const [vectorHits, ftsHits] = await Promise.all([
              // Vector arm (pgvector HNSW)
              queryEmbedding
                ? (async (): Promise<RagHit[]> => {
                    try {
                      const embLiteral = `[${queryEmbedding.join(',')}]`;
                      const rows = await this.db.execute(sql`
                        SELECT id, content, metadata,
                               source_id AS "sourceId", chunk_index AS "chunkIndex"
                        FROM knowledge_entries
                        WHERE knowledge_base_id = ${kbId}
                          AND embedding IS NOT NULL
                          AND status = 'indexed'
                          AND (embedding <=> ${embLiteral}::vector) < ${distanceThreshold}
                        ORDER BY embedding <=> ${embLiteral}::vector
                        LIMIT ${candidateK}
                      `);
                      return Array.from(rows) as RagHit[];
                    } catch {
                      return [];
                    }
                  })()
                : Promise.resolve([]),

              // BM25 arm (PostgreSQL FTS, GIN index from migration 0003)
              (async (): Promise<RagHit[]> => {
                try {
                  const rows = await this.db.execute(sql`
                    SELECT id, content, metadata,
                           source_id AS "sourceId", chunk_index AS "chunkIndex"
                    FROM knowledge_entries
                    WHERE knowledge_base_id = ${kbId}
                      AND status = 'indexed'
                      AND to_tsvector('english', content) @@ plainto_tsquery('english', ${q})
                    ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${q})) DESC
                    LIMIT ${candidateK}
                  `);
                  return Array.from(rows) as RagHit[];
                } catch {
                  return [];
                }
              })(),
            ]);

            if (vectorHits.length === 0 && ftsHits.length === 0) return [];

            // score = Σ weight / (60 + rank_i)   k=60 is the standard RRF constant
            const scores = new Map<string, number>();
            const docMap = new Map<string, RagHit>();

            const applyRrf = (hits: RagHit[], weight: number) =>
              hits.forEach((h, i) => {
                scores.set(h.id, (scores.get(h.id) ?? 0) + weight / (60 + i));
                docMap.set(h.id, h);
              });

            applyRrf(vectorHits, 0.7);
            applyRrf(ftsHits, 0.3);

            const merged = [...scores.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, enableRerank ? rerankTopK : topK)
              .map(([id]) => docMap.get(id)!);

            let ranked = merged;
            if (enableRerank) {
              const cohereKey = await this.memoryService.loadSecret(
                workspaceId,
                'COHERE_API_KEY',
              );
              if (cohereKey) {
                try {
                  const resp = await fetch('https://api.cohere.ai/v1/rerank', {
                    method: 'POST',
                    headers: {
                      Authorization: `Bearer ${cohereKey}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      model: 'rerank-v3.5',
                      query: q,
                      documents: merged.map((d) => d.content),
                      top_n: topK,
                    }),
                    signal: AbortSignal.timeout(10_000),
                  });
                  if (resp.ok) {
                    const json = (await resp.json()) as {
                      results: Array<{ index: number }>;
                    };
                    ranked = json.results.map((r) => merged[r.index]);
                  }
                } catch (err) {
                  this.logger.warn(
                    `Cohere rerank failed, using RRF order: ${err}`,
                  );
                  ranked = merged.slice(0, topK);
                }
              } else {
                ranked = merged.slice(0, topK);
              }
            } else {
              ranked = merged.slice(0, topK);
            }

            if (!expandContext) {
              return ranked.map(({ content, metadata }) => ({
                content,
                metadata,
              }));
            }

            return Promise.all(
              ranked.map(async (h) => {
                if (!h.sourceId || h.chunkIndex === null)
                  return { content: h.content, metadata: h.metadata };
                try {
                  const neighbors = await this.db
                    .select({
                      content: knowledgeEntries.content,
                      chunkIndex: knowledgeEntries.chunkIndex,
                    })
                    .from(knowledgeEntries)
                    .where(
                      and(
                        eq(knowledgeEntries.sourceId, h.sourceId),
                        inArray(knowledgeEntries.chunkIndex, [
                          h.chunkIndex - 1,
                          h.chunkIndex,
                          h.chunkIndex + 1,
                        ]),
                      ),
                    )
                    .orderBy(knowledgeEntries.chunkIndex);
                  const combined = neighbors.map((n) => n.content).join('\n');
                  return {
                    content: combined || h.content,
                    metadata: h.metadata,
                  };
                } catch {
                  return { content: h.content, metadata: h.metadata };
                }
              }),
            );
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
          return {
            result: { results: [], count: 0, failed: 0 },
            isAgentOutput: false,
          };
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
          if (firstFailure) throw firstFailure.reason;
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
        const r = await executeEvaluatorNode(
          nodeData,
          state,
          this.aiService,
          workspaceId,
        );
        return { result: r, isAgentOutput: false };
      }

      case 'slack': {
        const slackToken = await this.memoryService.resolveIntegrationToken(
          workspaceId,
          'slack',
          'SLACK_TOKEN',
        );
        const r = await executeSlackNode(nodeData, state, slackToken);
        return { result: r, isAgentOutput: false };
      }

      case 'github': {
        const ghToken = await this.memoryService.resolveIntegrationToken(
          workspaceId,
          'github',
          'GITHUB_TOKEN',
        );
        const r = await executeGitHubNode(nodeData, state, ghToken);
        return { result: r, isAgentOutput: false };
      }

      case 'notion': {
        const notionToken = await this.memoryService.resolveIntegrationToken(
          workspaceId,
          'notion',
          'NOTION_TOKEN',
        );
        const r = await executeNotionNode(nodeData, state, notionToken);
        return { result: r, isAgentOutput: false };
      }

      case 'gmail': {
        const gmailToken = await this.memoryService.resolveIntegrationToken(
          workspaceId,
          'google',
          'GMAIL_TOKEN',
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

  private async loadWorkspaceSettings(
    workspaceId: string,
  ): Promise<WorkspaceSettings> {
    const [ws] = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return ws?.settings ?? {};
  }

  private async resolveWorkspaceSupervisorModel(
    workspaceId: string,
  ): Promise<string | undefined> {
    const rows = await this.db
      .select({ settings: workspaces.settings })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    // Workspace setting takes priority; fall back to SUPERVISOR_MODEL env var so
    // existing deployments aren't broken on first node failure after deploy.
    return (
      rows[0]?.settings?.supervisorModel ||
      this.config.get<string>('SUPERVISOR_MODEL') ||
      undefined
    );
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
