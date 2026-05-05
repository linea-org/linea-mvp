import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { and, eq, desc, count } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { executions, executionLogs, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import type { CreateExecutionDto } from './dto/create-execution.dto';
import type { ListExecutionsDto } from './dto/list-executions.dto';
import { EXECUTION_QUEUE } from './queue/execution.queue';
import type { ExecutionJobData } from './queue/execution.queue';

@Injectable()
export class ExecutionsService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    @InjectQueue(EXECUTION_QUEUE)
    private readonly queue: Queue<ExecutionJobData>,
  ) {}

  async create(spaceId: string, workspaceId: string, _userId: string, dto: CreateExecutionDto) {
    return this.createFromTrigger(spaceId, workspaceId, dto.workflowId, 'manual', dto.input ?? {});
  }

  async createFromTrigger(
    spaceId: string,
    workspaceId: string,
    workflowId: string,
    triggeredBy: 'manual' | 'schedule' | 'webhook' | 'sdk',
    input: Record<string, unknown> = {},
  ) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, workflowId), eq(workflows.spaceId, spaceId)))
      .limit(1);

    if (!wf) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const threadId = `thread_${randomBytes(8).toString('hex')}`;

    const [execution] = await this.db
      .insert(executions)
      .values({
        workflowId,
        workspaceId,
        spaceId,
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
    };

    await this.queue.add('run', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });

    return execution;
  }

  async findAll(spaceId: string, query: ListExecutionsDto) {
    const conditions = [eq(executions.spaceId, spaceId)];
    if (query.workflowId) conditions.push(eq(executions.workflowId, query.workflowId));
    if (query.status) conditions.push(eq(executions.status, query.status as any));

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

  async findOne(spaceId: string, id: string) {
    const [execution] = await this.db
      .select()
      .from(executions)
      .where(and(eq(executions.id, id), eq(executions.spaceId, spaceId)))
      .limit(1);

    if (!execution) throw new NotFoundException(`Execution ${id} not found`);
    return execution;
  }

  async cancel(spaceId: string, id: string) {
    const execution = await this.findOne(spaceId, id);
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
    spaceId: string,
    id: string,
    dto: { approved?: boolean; answer?: string; comment?: string },
  ) {
    const execution = await this.findOne(spaceId, id);
    if (execution.status !== 'suspended') {
      throw new BadRequestException(`Execution ${id} is not waiting for a response`);
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
        `thread_${id}`,
      resumeValue,
    };

    await this.db
      .update(executions)
      .set({ status: 'queued' })
      .where(eq(executions.id, id));

    await this.queue.add('resume', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
    });

    return this.findOne(spaceId, id);
  }

  async approve(spaceId: string, id: string, approved: boolean, comment?: string) {
    return this.respond(spaceId, id, { approved, comment });
  }

  async getLogs(spaceId: string, id: string) {
    await this.findOne(spaceId, id);
    return this.db
      .select()
      .from(executionLogs)
      .where(eq(executionLogs.executionId, id))
      .orderBy(executionLogs.timestamp);
  }
}
