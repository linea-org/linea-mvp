import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelOrDefault } from './models/registry';
import { createModelClient } from './models/client.factory';
import type { ModelApiKeys } from './models/client.factory';
import type { WorkflowState } from './variable-substitution';

export type SupervisorAction = 'retry' | 'skip' | 'abort' | 'continue';

export interface SupervisorContext {
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  error?: string;
  elapsedMs: number;
  retryCount: number;
  maxRetries: number;
  state: Pick<WorkflowState, 'variables'>;
}

export interface SupervisorDecision {
  action: SupervisorAction;
  reason: string;
  retryDelayMs?: number;
}

@Injectable()
export class ExecutionSupervisor {
  private readonly logger = new Logger(ExecutionSupervisor.name);
  private readonly apiKeys: ModelApiKeys;
  private readonly supervisorModelId: string;

  constructor(private readonly config: ConfigService) {
    this.apiKeys = {
      ANTHROPIC_API_KEY: config.get('ANTHROPIC_API_KEY'),
      OPENAI_API_KEY: config.get('OPENAI_API_KEY'),
      GROQ_API_KEY: config.get('GROQ_API_KEY'),
      GOOGLE_API_KEY: config.get('GOOGLE_API_KEY'),
    };
    this.supervisorModelId =
      config.get('SUPERVISOR_MODEL') ?? 'claude-haiku-4-5';
  }

  /**
   * Assess whether to retry, skip, or abort a failed/timed-out node.
   * Only called when something goes wrong — zero cost on happy paths.
   */
  async assess(ctx: SupervisorContext): Promise<SupervisorDecision> {
    // Hard rules first — no LLM needed
    if (ctx.retryCount >= ctx.maxRetries) {
      return { action: 'abort', reason: `Exhausted ${ctx.maxRetries} retries` };
    }

    if (
      ctx.error?.includes('API key') ||
      ctx.error?.includes('authentication') ||
      ctx.error?.includes('401')
    ) {
      return {
        action: 'abort',
        reason: 'Authentication failure — check API keys',
      };
    }

    if (
      ctx.nodeType === 'transform' ||
      ctx.nodeType === 'if-else' ||
      ctx.nodeType === 'router'
    ) {
      // Deterministic nodes: if they fail it's a config error, not transient
      return {
        action: 'abort',
        reason: `Deterministic node failed: ${ctx.error}`,
      };
    }

    if (ctx.elapsedMs < 2_000 && ctx.retryCount === 0) {
      // Fast failure on first attempt — likely transient
      return {
        action: 'retry',
        reason: 'Fast failure, likely transient',
        retryDelayMs: 1_000,
      };
    }

    // For HTTP/agent nodes on second+ failure, ask the LLM
    try {
      return await this.askModel(ctx);
    } catch (err) {
      this.logger.warn(
        `Supervisor model call failed: ${err}. Defaulting to retry.`,
      );
      return {
        action: 'retry',
        reason: 'Supervisor unavailable, retrying once',
        retryDelayMs: 2_000,
      };
    }
  }

  private async askModel(ctx: SupervisorContext): Promise<SupervisorDecision> {
    const modelDef = getModelOrDefault(this.supervisorModelId, 'fast');
    const client = createModelClient(
      modelDef.id,
      modelDef.provider,
      this.apiKeys,
    );

    const isTimeout = !ctx.error;
    const situation = isTimeout
      ? `The node has been running for ${Math.round(ctx.elapsedMs / 1000)}s with no response.`
      : `The node failed with error: "${ctx.error}"`;

    const prompt = `You are a workflow execution supervisor. A node in a workflow has encountered a problem.

Node: ${ctx.nodeName || ctx.nodeId} (type: ${ctx.nodeType})
Retry attempt: ${ctx.retryCount + 1} of ${ctx.maxRetries}
Situation: ${situation}

Respond ONLY with valid JSON matching this exact shape:
{
  "action": "retry" | "skip" | "abort",
  "reason": "<one sentence>",
  "retryDelayMs": <number, only if action is retry>
}

Rules:
- "retry" if the error looks transient (network, rate limit, timeout on first attempt)
- "skip" if the node is non-critical and the workflow can continue without its output
- "abort" if the error is fatal (missing config, invalid data, repeated failure)`;

    const { text } = await client([{ role: 'user', content: prompt }], {
      maxTokens: 150,
      temperature: 0,
    });

    try {
      const clean = text.replace(/```json?\n?|```/g, '').trim();
      const parsed = JSON.parse(clean) as SupervisorDecision;
      if (!['retry', 'skip', 'abort', 'continue'].includes(parsed.action)) {
        throw new Error('Invalid action');
      }
      this.logger.debug(
        `Supervisor decision for ${ctx.nodeId}: ${parsed.action} — ${parsed.reason}`,
      );
      return parsed;
    } catch {
      // If the model gave bad JSON, fall back to retry
      return {
        action: 'retry',
        reason: 'Supervisor gave unparseable response',
        retryDelayMs: 2_000,
      };
    }
  }
}
