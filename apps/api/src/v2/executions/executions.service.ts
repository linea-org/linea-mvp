import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq, desc, count } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { Database } from '@linea/db';
import { executions, executionLogs } from '@linea/db';
import type { CreateExecutionDto } from './dto/create-execution.dto.js';
import type { ListExecutionsDto } from './dto/list-executions.dto.js';
import { QueueService } from '../services/queue/queue.service.js';

@Injectable()
export class ExecutionsService {
  constructor(
    private readonly db: Database,
    private readonly queue: QueueService,
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
    _userId?: string,
  ) {
    const wf = await this.db.workflow.findById(workflowId);
    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`);

    // await this.quotas.checkLimit(workspaceId);

    // Concurrency cap: prevent a single workspace from saturating workers
    const MAX_CONCURRENT = 10;
    const countRunning = await this.db.execution.countRunning(workspaceId);

    if (countRunning >= MAX_CONCURRENT) {
      throw new BadRequestException(
        `Too many concurrent executions (limit: ${MAX_CONCURRENT}). Wait for running executions to finish.`,
      );
    }

    const threadId = `thread_${randomBytes(8).toString('hex')}`;

    const execution = await this.db.execution.create({
      workflowId,
      workspaceId,
      podId,
      status: 'queued',
      input,
      threadId,
      triggeredBy,
    });

    if (!execution) {
      throw new Error(`Unable to create workflow execution at the moment`);
    }

    await this.queue.enqueueExecution(execution.id);

    return execution;
  }

  async findAll(podId: string, query: ListExecutionsDto) {
    const conditions = [eq(executions.podId, podId)];
    if (query.workflowId)
      conditions.push(eq(executions.workflowId, query.workflowId));
    if (query.status)
      conditions.push(eq(executions.status, query.status as any));

    const [{ total }] = await this.db.client
      .select({ total: count() })
      .from(executions)
      .where(and(...conditions));

    const rows = await this.db.client
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

  async findOne(_podId: string, id: string) {
    // todo add podId also
    const execution = await this.db.execution.findById(id);

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

    const [updated] = await this.db.client
      .update(executions)
      .set({ status: 'cancelled', finishedAt: new Date() })
      .where(eq(executions.id, id))
      .returning();

    return updated;
  }

  async respond(
    podId: string,
    id: string,
    _dto: { approved?: boolean; answer?: string; comment?: string },
  ) {
    const execution = await this.findOne(podId, id);
    if (execution.status !== 'suspended') {
      throw new BadRequestException(
        `Execution ${id} is not waiting for a response`,
      );
    }

    // const pendingInterrupt = (execution.variables as any)?.__pendingInterrupt;
    // let resumeValue: unknown;

    // if (pendingInterrupt?.type === 'ask_human') {
    //   resumeValue = { answer: dto.answer ?? dto.comment ?? '' };
    // } else {
    //   if (dto.approved === false) {
    //     resumeValue = { approved: false, reason: dto.comment ?? 'User denied' };
    //   } else {
    //     resumeValue = { approved: true, comment: dto.comment };
    //   }
    // }

    await this.db.client
      .update(executions)
      .set({ status: 'queued' })
      .where(eq(executions.id, id));

    await this.queue.enqueueExecution(execution.id);
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
    const original = await this.db.execution.findById(id);

    // await this.quotas.checkLimit(original.workspaceId);

    if (!original) {
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

    const execution = await this.db.execution.create({
      workflowId: original.workflowId,
      workspaceId: original.workspaceId,
      podId: original.podId,
      status: 'queued',
      input: original.input,
      threadId,
      triggeredBy: 'manual',
      checkpoint: {
        replayOf: original.id,
        resumeFrom: fromNodeId ?? null,
      },
    });

    if (!execution) {
      throw new Error('Unable to create workflow execution at the moment');
    }

    await this.queue.enqueueExecution(execution.id);
    return execution;
  }

  async getLogs(podId: string, id: string) {
    await this.findOne(podId, id);
    return this.db.client
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.executionId, id))
      .orderBy(executionLogs.timestamp);
  }
}
