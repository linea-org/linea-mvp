import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getModelOrDefault } from './models/registry';
import { createModelClient } from './models/client.factory';
import type { ModelApiKeys } from './models/client.factory';
import type { WorkflowState } from './variable-substitution';

type SupervisorAction = 'retry' | 'skip' | 'abort' | 'continue';

export interface SupervisorContext {
  nodeId: string;
  nodeType: string;
  nodeName?: string;
  error?: string;
  elapsedMs: number;
  retryCount: number;
  maxRetries: number;
  state: Pick<WorkflowState, 'variables'>;
  modelOverride?: string;
  /** Workspace-level supervisor model set in Settings → Model Preferences */
  workspaceSupervisorModel?: string;
  apiKeys: ModelApiKeys;
}

export interface SupervisorDecision {
  action: SupervisorAction;
  reason: string;
  retryDelayMs?: number;
}

@Injectable()
export class ExecutionSupervisor {
  private readonly logger = new Logger(ExecutionSupervisor.name);

  constructor(private readonly config: ConfigService) {}

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
      ctx.error?.includes('request size limit') ||
      ctx.error?.includes('Request too large') ||
      ctx.error?.includes('too large') ||
      ctx.error?.includes('context length') ||
      ctx.error?.includes('context_length_exceeded') ||
      ctx.error?.includes('maximum context') ||
      (ctx.error?.includes('tokens') && ctx.error?.includes('limit')) ||
      ctx.error?.includes('413')
    ) {
      return {
        action: 'abort',
        reason:
          'Input exceeds model context limit — reduce input size or use a model with a larger context window',
      };
    }

    if (
      ctx.error?.includes('Invalid URL') ||
      ctx.error?.includes('URL is required') ||
      ctx.error?.includes('unresolved variable') ||
      ctx.error?.includes('Failed to parse URL') ||
      ctx.error?.includes('URL scheme') ||
      ctx.error?.includes('private/internal address') ||
      ctx.error?.includes('Could not resolve hostname')
    ) {
      return {
        action: 'abort',
        reason:
          ctx.error ??
          'Invalid or missing URL — check the URL field in the node configuration',
      };
    }

    if (
      ctx.error?.toLowerCase().includes('connection error') ||
      ctx.error?.includes('ECONNREFUSED') ||
      ctx.error?.includes('ENOTFOUND') ||
      ctx.error?.includes('ETIMEDOUT') ||
      ctx.error?.includes('fetch failed')
    ) {
      if (ctx.retryCount === 0) {
        return {
          action: 'retry',
          reason: 'Connection error — retrying once',
          retryDelayMs: 2_000,
        };
      }
      return {
        action: 'abort',
        reason:
          'Provider unreachable after retry — check your API key is valid and the provider is accessible',
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

    // Guard: LLM call requires a configured supervisor model
    const supervisorModel = ctx.modelOverride ?? ctx.workspaceSupervisorModel;
    if (!supervisorModel) {
      return {
        action: 'abort',
        reason:
          'No supervisor model configured — go to Settings → Model Preferences to set one',
      };
    }

    // For HTTP/agent nodes on second+ failure, ask the LLM
    try {
      return await this.askModel(ctx, supervisorModel);
    } catch (err) {
      this.logger.warn(
        `Supervisor model call failed: ${err instanceof Error ? err.message : String(err)}. Original node error: ${ctx.error ?? '(timeout)'}.`,
      );
      return {
        action: 'abort',
        reason: `Supervisor model "${supervisorModel}" failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private async askModel(
    ctx: SupervisorContext,
    modelId: string,
  ): Promise<SupervisorDecision> {
    const modelDef = getModelOrDefault(modelId, 'fast');
    const client = createModelClient(
      modelDef.id,
      modelDef.provider,
      ctx.apiKeys,
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
