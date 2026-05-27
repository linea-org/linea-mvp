import { Injectable, Inject, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { eq, and, isNull } from 'drizzle-orm';
import { randomBytes, timingSafeEqual } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { workflows, pods, executions } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';
import { MemoryService } from '../executions/engine/memory.service';
import { createModelClient } from '../executions/engine/models/client.factory';
import { MODEL_REGISTRY } from '../executions/engine/models/registry';
import type { ModelApiKeys } from '../executions/engine/models/client.factory';
import type { ModelProvider } from '../executions/engine/models/registry';

/* ─── Input Enrichment Helpers ───────────────────────────────────────────── */

/** Scan a workflow definition for all {{input.X}} variable references. */
function extractInputVars(definition: unknown): string[] {
  const json = JSON.stringify(definition ?? {});
  const matches = [...json.matchAll(/\{\{input\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g)];
  return [...new Set(matches.map((m) => m[1]!))];
}

/** Find a natural-language message field in an input object. */
function findMessageField(input: Record<string, unknown>): string | null {
  for (const key of ['message', 'prompt', 'text', 'query', 'content']) {
    if (typeof input[key] === 'string' && (input[key] as string).trim()) {
      return input[key] as string;
    }
  }
  return null;
}

@Injectable()
export class PublicRunService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
    private readonly memoryService: MemoryService,
  ) {}

  async getSchema(workflowId: string) {
    const [row] = await this.db
      .select({
        id: workflows.id,
        name: workflows.name,
        description: workflows.description,
        isPublic: workflows.isPublic,
        apiEnabled: workflows.apiEnabled,
        apiVisibility: workflows.apiVisibility,
        definition: workflows.definition,
      })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), isNull(workflows.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');

    const accessible = row.isPublic || row.apiEnabled;
    if (!accessible) throw new ForbiddenException('This workflow is not publicly accessible');

    const def = row.definition as { nodes?: Array<{ type: string; data?: Record<string, unknown> }> };
    const startNode = def?.nodes?.find((n) => n.type === 'start');
    const inputVariables = (startNode?.data?.inputVariables as Array<{
      name: string;
      type: string;
      required?: boolean;
      description?: string;
      defaultValue?: string;
    }>) ?? [];

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      apiEnabled: row.apiEnabled,
      apiVisibility: row.apiVisibility,
      inputVariables,
    };
  }

  async trigger(workflowId: string, input: Record<string, unknown>, providedApiKey?: string) {
    const [row] = await this.db
      .select({
        id: workflows.id,
        podId: workflows.podId,
        isPublic: workflows.isPublic,
        apiEnabled: workflows.apiEnabled,
        apiVisibility: workflows.apiVisibility,
        apiKey: workflows.apiKey,
        definition: workflows.definition,
        workspaceId: pods.workspaceId,
      })
      .from(workflows)
      .innerJoin(pods, eq(pods.id, workflows.podId))
      .where(and(eq(workflows.id, workflowId), isNull(workflows.deletedAt)))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');

    // Check access
    if (row.apiEnabled) {
      if (row.apiVisibility === 'api_key') {
        if (!row.apiKey) throw new ForbiddenException('This workflow has no API key configured');
        if (!providedApiKey || !row.apiKey) {
          throw new UnauthorizedException('Invalid or missing API key');
        }
        const expBuf = Buffer.from(row.apiKey);
        const prvBuf = Buffer.from(providedApiKey);
        if (expBuf.length !== prvBuf.length || !timingSafeEqual(expBuf, prvBuf)) {
          throw new UnauthorizedException('Invalid or missing API key');
        }
      }
      // visibility === 'public' — no key check needed
    } else if (row.isPublic) {
      // legacy isPublic path — no key required
    } else {
      throw new ForbiddenException('This workflow is not accessible via the public API');
    }

    // ── Smart input enrichment ───────────────────────────────────────────
    const enrichedInput = await this.enrichInput(input, row.definition, row.workspaceId);
    if ('status' in enrichedInput && enrichedInput.status === 'needs_input') {
      return enrichedInput; // return guidance response instead of creating execution
    }

    const execution = await this.executionsService.createFromTrigger(
      row.podId,
      row.workspaceId,
      row.id,
      'manual',
      enrichedInput as Record<string, unknown>,
    );

    return { executionId: execution.id, status: execution.status };
  }

  private async enrichInput(
    input: Record<string, unknown>,
    definition: unknown,
    workspaceId: string,
  ): Promise<Record<string, unknown> | { status: 'needs_input'; message: string; requiredFields: Array<{ name: string }> }> {
    const requiredVars = extractInputVars(definition);
    if (requiredVars.length === 0) return input;

    const missingVars = requiredVars.filter(
      (v) => !(v in input) || input[v] === null || input[v] === undefined || input[v] === '',
    );
    if (missingVars.length === 0) return input;

    // Read extraction model preference from the start node
    const def = definition as { nodes?: Array<{ type: string; data?: Record<string, unknown> }> };
    const startNode = def?.nodes?.find((n) => n.type === 'start');
    const extractionModel = startNode?.data?.extractionModel as string | undefined;

    // Try LLM extraction from any message-like field
    const messageText = findMessageField(input);
    if (messageText) {
      const extracted = await this.extractVarsWithModel(messageText, missingVars, workspaceId, extractionModel);
      const enriched = { ...input, ...extracted };
      const stillMissing = missingVars.filter(
        (v) => !(v in enriched) || enriched[v] === null || enriched[v] === undefined || enriched[v] === '',
      );
      if (stillMissing.length === 0) return enriched;
      // Partial extraction: some resolved, some still missing
      if (Object.keys(extracted).length > 0) {
        return {
          status: 'needs_input',
          message: `I understood part of your request but still need a few more details to run this workflow:\n\n${stillMissing.map((v) => `• **${v}**: please provide this value`).join('\n')}\n\nExample: send your request with ${stillMissing.map((v) => `"${v}": "..."`).join(', ')} in the request body.`,
          requiredFields: stillMissing.map((v) => ({ name: v })),
        };
      }
    }

    // No message field or extraction returned nothing — explain what's needed
    const fieldList = missingVars.map((v) => `• **${v}**`).join('\n');
    return {
      status: 'needs_input',
      message: `To run this workflow, please provide the following ${missingVars.length === 1 ? 'field' : 'fields'} in your request:\n\n${fieldList}\n\nSend a JSON body with these fields and try again.`,
      requiredFields: missingVars.map((v) => ({ name: v })),
    };
  }

  private async extractVarsWithModel(
    message: string,
    missingVars: string[],
    workspaceId: string,
    preferredModelId?: string,
  ): Promise<Record<string, string>> {
    // Load workspace API keys for all providers in parallel
    const [anthropicKey, openaiKey, groqKey, googleKey] = await Promise.all([
      this.memoryService.loadApiKey(workspaceId, 'anthropic'),
      this.memoryService.loadApiKey(workspaceId, 'openai'),
      this.memoryService.loadApiKey(workspaceId, 'groq'),
      this.memoryService.loadApiKey(workspaceId, 'google'),
    ]);

    const apiKeys: ModelApiKeys = {
      ANTHROPIC_API_KEY: anthropicKey,
      OPENAI_API_KEY: openaiKey,
      GROQ_API_KEY: groqKey,
      GOOGLE_API_KEY: googleKey,
    };

    // Build candidate list — preferred model first, then cheap fallbacks
    const candidates: Array<{ modelId: string; provider: ModelProvider }> = [];

    if (preferredModelId) {
      const modelDef = MODEL_REGISTRY[preferredModelId];
      if (modelDef) candidates.push({ modelId: modelDef.id, provider: modelDef.provider });
    }

    // Cheap/fast fallbacks in preference order
    if (anthropicKey) candidates.push({ modelId: 'claude-haiku-4-5', provider: 'anthropic' });
    if (groqKey) candidates.push({ modelId: 'llama-3.1-8b-instant', provider: 'groq' });
    if (openaiKey) candidates.push({ modelId: 'gpt-4o-mini', provider: 'openai' });
    if (googleKey) candidates.push({ modelId: 'gemini-2.0-flash', provider: 'google' });
    // Ollama is always available as last resort (local, no key required)
    candidates.push({ modelId: 'llama3.2', provider: 'ollama' });

    // Deduplicate while preserving order
    const seen = new Set<string>();
    const uniqueCandidates = candidates.filter((c) => {
      if (seen.has(c.modelId)) return false;
      seen.add(c.modelId);
      return true;
    });

    const prompt = `Extract structured data from the user message below.

Required fields to extract: ${missingVars.map((v) => `"${v}"`).join(', ')}

User message: "${message}"

Rules:
- For "url" or any URL-like field: extract any full URL starting with http:// or https://
- For "email": extract any email address
- For "number" or "count": extract numeric values as strings
- If a field clearly cannot be determined, omit it from the response
- Return ONLY valid JSON with the extracted fields, nothing else`;

    for (const { modelId, provider } of uniqueCandidates) {
      try {
        const client = createModelClient(modelId, provider, apiKeys);
        const { text } = await client([{ role: 'user', content: prompt }], {
          maxTokens: 256,
          temperature: 0,
        });
        const clean = text.replace(/```json?\n?|```/g, '').trim();
        return JSON.parse(clean) as Record<string, string>;
      } catch {
        // try next candidate
      }
    }
    return {};
  }

  async getExecutionStatus(workflowId: string, executionId: string, providedApiKey?: string) {
    // Verify workflow access first (same key check as trigger)
    const [wf] = await this.db
      .select({
        id: workflows.id,
        apiEnabled: workflows.apiEnabled,
        apiVisibility: workflows.apiVisibility,
        apiKey: workflows.apiKey,
        isPublic: workflows.isPublic,
      })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), isNull(workflows.deletedAt)))
      .limit(1);

    if (!wf) throw new NotFoundException('Workflow not found');

    if (wf.apiEnabled) {
      if (wf.apiVisibility === 'api_key') {
        if (!wf.apiKey || !providedApiKey) {
          throw new UnauthorizedException('Invalid or missing API key');
        }
        const expBuf = Buffer.from(wf.apiKey);
        const prvBuf = Buffer.from(providedApiKey);
        if (expBuf.length !== prvBuf.length || !timingSafeEqual(expBuf, prvBuf)) {
          throw new UnauthorizedException('Invalid or missing API key');
        }
      }
    } else if (!wf.isPublic) {
      throw new ForbiddenException('This workflow is not publicly accessible');
    }

    const [row] = await this.db
      .select({
        id: executions.id,
        status: executions.status,
        output: executions.output,
        error: executions.error,
        startedAt: executions.startedAt,
        finishedAt: executions.finishedAt,
        tokenUsage: executions.tokenUsage,
      })
      .from(executions)
      .where(and(eq(executions.id, executionId), eq(executions.workflowId, workflowId)))
      .limit(1);

    if (!row) throw new NotFoundException('Execution not found');

    return {
      executionId: row.id,
      status: row.status,
      output: row.status === 'completed' ? (row.output as { result?: unknown } | null)?.result ?? null : null,
      error: row.error,
      startedAt: row.startedAt?.toISOString() ?? null,
      finishedAt: row.finishedAt?.toISOString() ?? null,
      tokenUsage: row.tokenUsage,
    };
  }

  async rotateApiKey(workflowId: string, podId: string): Promise<string> {
    const [row] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');

    const newKey = `lnk_${randomBytes(24).toString('hex')}`;
    await this.db
      .update(workflows)
      .set({ apiKey: newKey })
      .where(eq(workflows.id, workflowId));

    return newKey;
  }

  async setApiConfig(
    workflowId: string,
    podId: string,
    config: { apiEnabled?: boolean; apiVisibility?: 'api_key' | 'public' },
  ) {
    const [row] = await this.db
      .select({ id: workflows.id, apiKey: workflows.apiKey })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');

    const updates: Record<string, unknown> = {};
    if (config.apiEnabled !== undefined) updates.apiEnabled = config.apiEnabled;
    if (config.apiVisibility !== undefined) updates.apiVisibility = config.apiVisibility;

    // Auto-generate API key if enabling and none exists
    if (config.apiEnabled && !row.apiKey) {
      updates.apiKey = `lnk_${randomBytes(24).toString('hex')}`;
    }

    await this.db.update(workflows).set(updates).where(eq(workflows.id, workflowId));

    const [updated] = await this.db
      .select({ apiEnabled: workflows.apiEnabled, apiVisibility: workflows.apiVisibility, apiKey: workflows.apiKey })
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1);

    return updated;
  }

  async getApiConfig(workflowId: string, podId: string) {
    const [row] = await this.db
      .select({ apiEnabled: workflows.apiEnabled, apiVisibility: workflows.apiVisibility, apiKey: workflows.apiKey })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');
    // Never return the raw key — callers see only whether one is configured
    return { apiEnabled: row.apiEnabled, apiVisibility: row.apiVisibility, hasApiKey: !!row.apiKey };
  }
}
