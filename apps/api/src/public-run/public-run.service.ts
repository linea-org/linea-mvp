import { Injectable, Inject, NotFoundException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { workflows, pods, executions } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';

@Injectable()
export class PublicRunService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
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
      .where(eq(workflows.id, workflowId))
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
        workspaceId: pods.workspaceId,
      })
      .from(workflows)
      .innerJoin(pods, eq(pods.id, workflows.podId))
      .where(eq(workflows.id, workflowId))
      .limit(1);

    if (!row) throw new NotFoundException('Workflow not found');

    // Check access
    if (row.apiEnabled) {
      if (row.apiVisibility === 'api_key') {
        if (!row.apiKey) throw new ForbiddenException('This workflow has no API key configured');
        if (!providedApiKey || providedApiKey !== row.apiKey) {
          throw new UnauthorizedException('Invalid or missing API key');
        }
      }
      // visibility === 'public' — no key check needed
    } else if (row.isPublic) {
      // legacy isPublic path — no key required
    } else {
      throw new ForbiddenException('This workflow is not accessible via the public API');
    }

    const execution = await this.executionsService.createFromTrigger(
      row.podId,
      row.workspaceId,
      row.id,
      'manual',
      input,
    );

    return { executionId: execution.id, status: execution.status };
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
      .where(eq(workflows.id, workflowId))
      .limit(1);

    if (!wf) throw new NotFoundException('Workflow not found');

    if (wf.apiEnabled) {
      if (wf.apiVisibility === 'api_key') {
        if (!wf.apiKey || !providedApiKey || providedApiKey !== wf.apiKey) {
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
    return row;
  }
}
