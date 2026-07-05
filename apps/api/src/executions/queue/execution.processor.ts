import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq, desc } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { executions, executionLogs, workflows, users } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module.js';
import { LangGraphService } from '../engine/langgraph.service.js';
import type { WorkflowDefinition } from '../engine/langgraph.service.js';
import { ExecutionEventsService } from '../execution-events.service.js';
import { MemoryService } from '../engine/memory.service.js';
import { CheckpointerService } from '../engine/checkpointer.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { QuotasService } from '../../quotas/quotas.service.js';
import { MailService } from '../../mail/mail.service.js';
import { EXECUTION_QUEUE } from './execution.queue.js';
import type { ExecutionJobData } from './execution.queue.js';
import { drainWithTimeout } from '../engine/drain-with-timeout.js';

const EXECUTION_TIMEOUT_MS = 15 * 60 * 1_000; // 15 minutes wall-clock per execution

@Processor(EXECUTION_QUEUE)
export class ExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionProcessor.name);
  private readonly FAILURE_NOTIFY_THRESHOLD = 3;
  private readonly FAILURE_NOTIFY_INTERVAL = 10;

  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly langGraph: LangGraphService,
    private readonly events: ExecutionEventsService,
    private readonly memoryService: MemoryService,
    private readonly checkpointerService: CheckpointerService,
    private readonly notifications: NotificationsService,
    private readonly quotas: QuotasService,
    private readonly mail: MailService,
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

    let wf: typeof workflows.$inferSelect | undefined;
    let triggeredBy: typeof executions.$inferSelect.triggeredBy = 'manual';

    try {
      const [execRow] = await this.db
        .update(executions)
        .set({
          status: 'running',
          startedAt: isResume ? undefined : new Date(),
        })
        .where(eq(executions.id, executionId))
        .returning({ triggeredBy: executions.triggeredBy });
      triggeredBy = execRow?.triggeredBy ?? 'manual';

      [wf] = await this.db
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

        if (userId) {
          void this.sendApprovalEmail(
            userId,
            wf.name,
            executionId,
            workspaceId,
            wf.podId,
            finalState.pendingInterrupt,
          );
        }
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

        void this.quotas.incrementUsed(
          workspaceId,
          usage?.total_tokens ?? 0,
          userId,
        );
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
        // Unattended triggers (schedule/webhook/sdk) have nobody watching the run live,
        // unlike manual runs where the user is already in the builder — only notify those,
        // and only once a failure streak crosses a threshold so a broken cron doesn't spam.
        if (triggeredBy !== 'manual') {
          const streak = await this.getConsecutiveFailureCount(workflowId);
          if (this.shouldNotifyFailureStreak(streak)) {
            void this.notifications.create(
              userId,
              'execution_failed',
              'Workflow repeatedly failing',
              `${wf?.name ?? workflowId} has failed ${streak} times in a row (${triggeredBy}). Latest error: ${msg}`,
              workspaceId,
            );
          }
        }
        void this.sendFailureEmail(
          userId,
          wf?.name ?? workflowId,
          executionId,
          workspaceId,
          wf?.podId ?? '',
          msg,
        );
      }

      throw error;
    }
  }

  private shouldNotifyFailureStreak(streak: number): boolean {
    if (streak < this.FAILURE_NOTIFY_THRESHOLD) return false;
    return (
      (streak - this.FAILURE_NOTIFY_THRESHOLD) %
        this.FAILURE_NOTIFY_INTERVAL ===
      0
    );
  }

  private async getConsecutiveFailureCount(
    workflowId: string,
  ): Promise<number> {
    const recent = await this.db
      .select({ status: executions.status })
      .from(executions)
      .where(eq(executions.workflowId, workflowId))
      .orderBy(desc(executions.createdAt))
      .limit(50);

    let streak = 0;
    for (const row of recent) {
      if (row.status !== 'failed') break;
      streak++;
    }
    return streak;
  }

  private async sendFailureEmail(
    userId: string,
    workflowName: string,
    executionId: string,
    workspaceId: string,
    podId: string,
    error: string,
  ) {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.email) return;
    void this.mail.sendExecutionFailed({
      toEmail: user.email,
      workflowName,
      executionId,
      workspaceId,
      podId,
      error,
    });
  }

  private async sendApprovalEmail(
    userId: string,
    workflowName: string,
    executionId: string,
    workspaceId: string,
    podId: string,
    interrupt: unknown,
  ) {
    const [user] = await this.db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user?.email) return;
    const message =
      (interrupt as any)?.message ?? 'Your approval is required to continue.';
    void this.mail.sendApprovalRequired({
      toEmail: user.email,
      workflowName,
      executionId,
      workspaceId,
      podId,
      message,
    });
  }
}
