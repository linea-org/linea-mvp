import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isGraphInterrupt } from '@langchain/langgraph';
import type { WorkflowState } from './variable-substitution';
import { executeAgentNode } from './executors/agent.executor';
import { executeHTTPNode } from './executors/http.executor';
import { executeTransformNode } from './executors/transform.executor';
import { executeLogicNode } from './executors/logic.executor';
import { ExecutionSupervisor } from './supervisor';
import { MemoryService } from './memory.service';
import type { ModelApiKeys } from './models/client.factory';

export interface NodeInput {
  nodeId: string;
  nodeType: string;
  nodeData: Record<string, any>;
  state: WorkflowState;
  workspaceId: string;
}

export interface NodeOutput {
  result: any;
  isAgentOutput: boolean;
}

// Default timeouts per node type (ms). Override per-node via nodeData.timeoutMs.
const DEFAULT_TIMEOUTS: Record<string, number> = {
  agent: 120_000, // 2 min — LLM calls can be slow
  http: 30_000, // 30s
  transform: 5_000, // 5s — should be instant
  'if-else': 1_000,
  router: 1_000,
  start: 2_000,
  end: 1_000,
  approval: 0, // 0 = no timeout (waits indefinitely for human)
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
  ) {
    this.envApiKeys = {
      ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: config.get('OPENAI_API_KEY'),
      GROQ_API_KEY: config.get('GROQ_API_KEY'),
      GOOGLE_API_KEY: config.get('GOOGLE_API_KEY'),
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

    throw (
      lastError ??
      new Error(`Node ${nodeId} failed after ${maxRetries} retries`)
    );
  }

  private async dispatch({
    nodeId,
    nodeType,
    nodeData,
    state,
    workspaceId,
  }: NodeInput): Promise<NodeOutput> {
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
        const raw = await executeAgentNode(data, state, resolvedKeys);
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
      case 'if / else':
      case 'router': {
        const r = executeLogicNode(nodeData, state);
        return { result: r, isAgentOutput: false };
      }

      case 'approval':
        return {
          result: {
            __pendingApproval: true,
            message: nodeData.instructions || 'Approval required',
          },
          isAgentOutput: false,
        };

      case 'note':
        return { result: { skipped: true }, isAgentOutput: false };

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
        const dbKey = await this.memoryService.loadApiKey(
          workspaceId,
          provider,
        );
        if (dbKey) resolved[key] = dbKey;
      }),
    );

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
        (err) => {
          clearTimeout(timer);
          reject(err);
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
