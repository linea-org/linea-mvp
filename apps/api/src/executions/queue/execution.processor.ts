import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Inject } from '@nestjs/common';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { executions, executionLogs, workflows } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';
import { LangGraphService } from '../engine/langgraph.service';
import type { WorkflowDefinition } from '../engine/langgraph.service';
import { ExecutionEventsService } from '../execution-events.service';
import { MemoryService } from '../engine/memory.service';
import { CheckpointerService } from '../engine/checkpointer.service';
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

      const checkpointer = this.checkpointerService.checkpointer;

      const onNodeUpdate = async (
        nodeId: string,
        status: 'running' | 'completed' | 'failed' | 'suspended',
        output?: any,
        error?: string,
      ) => {
        await this.db.insert(executionLogs).values({
          executionId,
          nodeId,
          level: status === 'failed' ? 'error' : 'info',
          message: `Node ${nodeId} ${status}`,
          data: output !== undefined ? { output } : error ? { error } : null,
        });

        this.events.emit(executionId, {
          type: 'node_update',
          nodeId,
          status,
          output,
          error,
        });
      };

      let finalState: any;

      if (isResume) {
        const stream = this.langGraph.resumeFromApproval(
          definition,
          threadId,
          resumeValue,
          onNodeUpdate,
          workspaceId,
          checkpointer,
          workflowId,
        );
        for await (const state of stream) finalState = state;
      } else {
        // Load persisted memory from previous runs before starting
        const initialMemory = await this.memoryService.loadForExecution(
          workspaceId,
          workflowId,
          threadId,
        );
        const stream = this.langGraph.stream(
          definition,
          input,
          onNodeUpdate,
          threadId,
          workspaceId,
          checkpointer,
          initialMemory,
          workflowId,
          preloadedState,
        );
        for await (const state of stream) finalState = state;
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


        await this.db
          .update(executions)
          .set({
            status: 'completed',
            output: finalOutput !== null ? { result: finalOutput } : null,
            nodeResults: finalState?.nodeResults ?? {},
            variables: finalState?.variables ?? {},
            finishedAt: new Date(),
          })
          .where(eq(executions.id, executionId));

        this.events.emit(executionId, {
          type: 'execution_complete',
          status: 'completed',
          output: finalOutput,
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Execution ${executionId} failed: ${msg}`);
      await this.db
        .update(executions)
        .set({ status: 'failed', error: msg, finishedAt: new Date() })
        .where(eq(executions.id, executionId));

      this.events.emit(executionId, { type: 'execution_failed', error: msg });
      throw error;
    }
  }
}
