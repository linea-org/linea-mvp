import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';

const EXECUTION_TIMEOUT_MS = 15 * 60 * 1_000; // 15 minutes wall-clock per execution

async function drainWithTimeout<T>(
  gen: AsyncIterable<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  let last: T | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Execution timed out after ${timeoutMs / 60_000} minutes`)),
      timeoutMs,
    );
  });
  try {
    // Race: each iteration either yields from the generator or the timeout fires
    for await (const state of {
      [Symbol.asyncIterator]: () => {
        const iter = gen[Symbol.asyncIterator]();
        return {
          next: () => Promise.race([iter.next(), timeoutPromise]) as Promise<IteratorResult<T>>,
          return: iter.return?.bind(iter),
        };
      },
    } as AsyncIterable<T>) {
      last = state;
    }
    return last;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
import type { DrizzleDB } from '@linea/db';
import { executions, executionLogs, workflows } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';
import { LangGraphService } from '../engine/langgraph.service';
import type { WorkflowDefinition } from '../engine/langgraph.service';
import { ExecutionEventsService } from '../execution-events.service';
import { MemoryService } from '../engine/memory.service';
import { CheckpointerService } from '../engine/checkpointer.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { QuotasService } from '../../quotas/quotas.service';
import { EXECUTION_QUEUE } from './execution.queue';
import type { ExecutionJobData } from './execution.queue';

@Processor(EXECUTION_QUEUE)
export class ExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly langGraph: LangGraphService,
    private readonly events: ExecutionEventsService,
    private readonly memoryService: MemoryService,
    private readonly checkpointerService: CheckpointerService,
    private readonly notifications: NotificationsService,
    private readonly quotas: QuotasService,
  ) {
    super();
  }

  async process(job: Job<ExecutionJobData>): Promise<void> {
    const {
      executionId,
      workflowId,
      workspaceId,
      input,
      threadId,
      userId,
      resumeValue,
      preloadedState,
    } = job.data;
    const isResume = resumeValue !== undefined;

    this.logger.log(
      `${isResume ? 'Resuming' : 'Starting'} execution ${executionId} (thread: ${threadId})`,
    );

    try {
      await this.db
        .update(executions)
        .set({
          status: 'running',
          startedAt: isResume ? undefined : new Date(),
        })
        .where(eq(executions.id, executionId));

      const [wf] = await this.db
        .select()
        .from(workflows)
        .where(eq(workflows.id, workflowId))
        .limit(1);

      if (!wf) throw new Error(`Workflow ${workflowId} not found`);

      const definition = wf.definition as unknown as WorkflowDefinition;
      const logLevel = (wf as any).logLevel ?? 'info';

      const checkpointer = this.checkpointerService.checkpointer;

      const onNodeUpdate = async (
        nodeId: string,
        status: 'running' | 'completed' | 'failed' | 'suspended',
        output?: any,
        error?: string,
        durationMs?: number,
      ) => {
        const level = status === 'failed' ? 'error' : 'info';

        // Determine whether to persist this log entry based on workflow log settings
        const shouldPersist =
          logLevel !== 'none' &&
          !(logLevel === 'errors' && level !== 'error') &&
          !(logLevel === 'info' && status === 'running') &&
          !(logLevel === 'info' && status === 'suspended');

        if (shouldPersist) {
          await this.db.insert(executionLogs).values({
            executionId,
            nodeId,
            level,
            message: `Node ${nodeId} ${status}`,
            data: output !== undefined ? { output } : error ? { error } : null,
            durationMs: durationMs ?? null,
          });
        }

        this.events.emit(executionId, {
          type: 'node_update',
          nodeId,
          status,
          output,
          error,
          durationMs,
        });
      };

      const onAgentToken = (nodeId: string, delta: string) => {
        this.events.emit(executionId, { type: 'agent_token', nodeId, delta });
      };

      let finalState: any;

      if (isResume) {
        finalState = await drainWithTimeout(
          this.langGraph.resumeFromApproval(
            definition,
            threadId,
            resumeValue,
            onNodeUpdate,
            workspaceId,
            checkpointer,
            workflowId,
            onAgentToken,
          ),
          EXECUTION_TIMEOUT_MS,
        );
      } else {
        // Load persisted memory from previous runs before starting
        const initialMemory = await this.memoryService.loadForExecution(
          workspaceId,
          workflowId,
          threadId,
        );
        finalState = await drainWithTimeout(
          this.langGraph.stream(
            definition,
            input,
            onNodeUpdate,
            threadId,
            workspaceId,
            checkpointer,
            initialMemory,
            workflowId,
            preloadedState,
            onAgentToken,
          ),
          EXECUTION_TIMEOUT_MS,
        );
      }

      const isSuspended = Boolean(finalState?.pendingInterrupt);
      const finalOutput = finalState?.variables?.lastOutput ?? null;

      if (isSuspended) {
        // Persist memory accumulated before the interrupt so it's not lost
        await this.memoryService.saveFromExecution(
          workspaceId,
          workflowId,
          threadId,
          finalState?.memory ?? {},
        );

        const existingVars = (finalState?.variables ?? {}) as Record<
          string,
          any
        >;
        await this.db
          .update(executions)
          .set({
            status: 'suspended',
            nodeResults: finalState?.nodeResults ?? {},
            variables: {
              ...existingVars,
              __pendingInterrupt: finalState.pendingInterrupt,
            },
          })
          .where(eq(executions.id, executionId));

        this.events.emit(executionId, {
          type: 'execution_suspended',
          interrupt: finalState.pendingInterrupt,
        });
      } else {
        // Persist memory before cleanup so next execution can load it
        await this.memoryService.saveFromExecution(
          workspaceId,
          workflowId,
          threadId,
          finalState?.memory ?? {},
        );

        const usage = finalState?.cumulativeUsage;
        await this.db
          .update(executions)
          .set({
            status: 'completed',
            output: finalOutput !== null ? { result: finalOutput } : null,
            nodeResults: finalState?.nodeResults ?? {},
            variables: finalState?.variables ?? {},
            finishedAt: new Date(),
            ...(usage && (usage.input_tokens > 0 || usage.output_tokens > 0)
              ? {
                  tokenUsage: {
                    input: usage.input_tokens,
                    output: usage.output_tokens,
                    total: usage.total_tokens,
                  },
                }
              : {}),
          })
          .where(eq(executions.id, executionId));

        this.events.emit(executionId, {
          type: 'execution_complete',
          status: 'completed',
          output: finalOutput,
        });

        void this.quotas.incrementUsed(workspaceId, usage?.total_tokens ?? 0);

        if (userId) {
          void this.notifications.create(
            userId,
            'execution_complete',
            'Execution completed',
            `Execution ${executionId} finished successfully.`,
            workspaceId,
          );
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Execution ${executionId} failed: ${msg}`);
      await this.db
        .update(executions)
        .set({ status: 'failed', error: msg, finishedAt: new Date() })
        .where(eq(executions.id, executionId));

      this.events.emit(executionId, { type: 'execution_failed', error: msg });

      if (userId) {
        void this.notifications.create(
          userId,
          'execution_failed',
          'Execution failed',
          msg,
          workspaceId,
        );
      }

      throw error;
    }
  }
}
