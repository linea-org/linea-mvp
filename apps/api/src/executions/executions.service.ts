import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, desc, count, inArray, isNull } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { executions, executionLogs, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';
import { QuotasService } from '../quotas/quotas.service.js';
import type { CreateExecutionDto } from './dto/create-execution.dto.js';
import type { ListExecutionsDto } from './dto/list-executions.dto.js';
import { EXECUTION_QUEUE } from './queue/execution.queue.js';
import type { ExecutionJobData } from './queue/execution.queue.js';

@Injectable()
export class ExecutionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    @InjectQueue(EXECUTION_QUEUE)
    private readonly queue: Queue<ExecutionJobData>,
    private readonly quotas: QuotasService,
  ) {}

  async create(
    podId: string,
    workspaceId: string,
    userId: string,
    dto: CreateExecutionDto,
  ) {
    return this.createFromTrigger(
      podId,
      workspaceId,
      dto.workflowId,
      'manual',
      dto.input ?? {},
      userId,
    );
  }

  async createFromTrigger(
    podId: string,
    workspaceId: string,
    workflowId: string,
    triggeredBy: 'manual' | 'schedule' | 'webhook' | 'sdk',
    input: Record<string, unknown> = {},
    userId?: string,
  ) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(
        and(
          eq(workflows.id, workflowId),
          eq(workflows.podId, podId),
          isNull(workflows.deletedAt),
        ),
      )
      .limit(1);

    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`);

    await this.quotas.checkLimit(workspaceId);

    // Concurrency cap: prevent a single workspace from saturating workers
    const MAX_CONCURRENT = 10;
    const [activeRow] = await this.db
      .select({ n: count() })
      .from(executions)
      .where(
        and(
          eq(executions.workspaceId, workspaceId),
          inArray(executions.status, ['queued', 'running']),
        ),
      );
    if ((activeRow?.n ?? 0) >= MAX_CONCURRENT) {
      throw new BadRequestException(
        `Too many concurrent executions (limit: ${MAX_CONCURRENT}). Wait for running executions to finish.`,
      );
    }

    const threadId = `thread_${randomBytes(8).toString('hex')}`;

    const [execution] = await this.db
      .insert(executions)
      .values({
        workflowId,
        workspaceId,
        podId,
        status: 'queued',
        input,
        threadId,
        triggeredBy,
      })
      .returning();

    const jobData: ExecutionJobData = {
      executionId: execution.id,
      workflowId,
      workspaceId,
      input,
      threadId,
      userId,
    };

    await this.queue.add('run', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return execution;
  }

  async findAll(podId: string, query: ListExecutionsDto) {
    const conditions = [eq(executions.podId, podId)];
    if (query.workflowId)
      conditions.push(eq(executions.workflowId, query.workflowId));
    if (query.status)
      conditions.push(eq(executions.status, query.status as any));

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(executions)
      .where(and(...conditions));

    const rows = await this.db
      .select()
      .from(executions)
      .where(and(...conditions))
      .orderBy(desc(executions.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    return {
      executions: rows,
      meta: { page: query.page, limit: query.limit, total: total ?? 0 },
    };
  }

  async findOne(podId: string, id: string) {
    const [execution] = await this.db
      .select()
      .from(executions)
      .where(and(eq(executions.id, id), eq(executions.podId, podId)))
      .limit(1);

    if (!execution) throw new NotFoundException(`Execution ${id} not found`);
    return execution;
  }

  async cancel(podId: string, id: string) {
    const execution = await this.findOne(podId, id);
    if (!['queued', 'running', 'suspended'].includes(execution.status)) {
      throw new BadRequestException(
        `Cannot cancel execution in '${execution.status}' state`,
      );
    }

    const [updated] = await this.db
      .update(executions)
      .set({ status: 'cancelled', finishedAt: new Date() })
      .where(eq(executions.id, id))
      .returning();

    return updated;
  }

  async respond(
    podId: string,
    id: string,
    dto: { approved?: boolean; answer?: string; comment?: string },
  ) {
    const execution = await this.findOne(podId, id);
    if (execution.status !== 'suspended') {
      throw new BadRequestException(
        `Execution ${id} is not waiting for a response`,
      );
    }

    const pendingInterrupt = (execution.variables as any)?.__pendingInterrupt;
    let resumeValue: unknown;

    if (pendingInterrupt?.type === 'ask_human') {
      resumeValue = { answer: dto.answer ?? dto.comment ?? '' };
    } else {
      if (dto.approved === false) {
        resumeValue = { approved: false, reason: dto.comment ?? 'User denied' };
      } else {
        resumeValue = { approved: true, comment: dto.comment };
      }
    }

    const jobData: ExecutionJobData = {
      executionId: id,
      workflowId: execution.workflowId!,
      workspaceId: execution.workspaceId,
      input: execution.input as Record<string, any>,
      threadId:
        execution.threadId ??
        (execution.variables as any)?.__threadId ??
        `thread_exec_${id}`,
      resumeValue,
    };

    await this.db
      .update(executions)
      .set({ status: 'queued' })
      .where(eq(executions.id, id));

    await this.queue.add('resume', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return this.findOne(podId, id);
  }

  async approve(
    podId: string,
    id: string,
    approved: boolean,
    comment?: string,
  ) {
    return this.respond(podId, id, { approved, comment });
  }

  async replay(podId: string, id: string, fromNodeId?: string) {
    const original = await this.findOne(podId, id);

    await this.quotas.checkLimit(original.workspaceId);

    if (!original.workflowId) {
      throw new BadRequestException(
        'Cannot replay an execution with no workflow',
      );
    }
    if (!['completed', 'failed', 'cancelled'].includes(original.status)) {
      throw new BadRequestException(
        `Can only replay completed, failed, or cancelled executions (current: ${original.status})`,
      );
    }

    const threadId = `thread_${randomBytes(8).toString('hex')}`;
    const input = original.input as Record<string, any>;

    // Build preloaded state: variables from original + nodeResults marked __preloaded
    // for all nodes that completed before fromNodeId
    let preloadedState: ExecutionJobData['preloadedState'] | undefined;

    if (fromNodeId) {
      const origNodeResults = (original.nodeResults ?? {}) as Record<
        string,
        any
      >;
      const origVariables = (original.variables ?? {}) as Record<string, any>;

      // Load workflow definition to determine topology order
      const [wf] = await this.db
        .select({ definition: workflows.definition })
        .from(workflows)
        .where(eq(workflows.id, original.workflowId))
        .limit(1);

      // Nodes that completed before fromNodeId (by wall-clock completedAt order)
      const completedBefore = Object.entries(origNodeResults)
        .filter(
          ([nodeId, r]: [string, any]) =>
            nodeId !== fromNodeId && r?.status === 'completed',
        )
        .reduce<Record<string, any>>((acc, [nodeId, r]) => {
          acc[nodeId] = { ...r, __preloaded: true };
          return acc;
        }, {});

      preloadedState = {
        variables: { ...origVariables, input },
        nodeResults: completedBefore,
      };

      void wf; // loaded but not used for ordering (completedAt order is sufficient)
    }

    const [newExecution] = await this.db
      .insert(executions)
      .values({
        workflowId: original.workflowId,
        workspaceId: original.workspaceId,
        podId: original.podId!,
        status: 'queued',
        input,
        threadId,
        triggeredBy: 'manual',
        checkpoint: { replayOf: id, fromNodeId: fromNodeId ?? null },
      })
      .returning();

    const jobData: ExecutionJobData = {
      executionId: newExecution.id,
      workflowId: original.workflowId,
      workspaceId: original.workspaceId,
      input,
      threadId,
      preloadedState,
    };

    await this.queue.add('run', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return newExecution;
  }

  async getLogs(podId: string, id: string) {
    await this.findOne(podId, id);
    return this.db
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.executionId, id))
      .orderBy(executionLogs.timestamp);
  }
}
