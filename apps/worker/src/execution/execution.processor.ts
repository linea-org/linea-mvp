import { Injectable, Logger, NotFoundException } from '@nestjs/common';

import { Database } from '@linea/db';
import { Runtime } from '@linea/runtime';

@Injectable()
export class ExecutionProcessor {
  private readonly logger = new Logger(ExecutionProcessor.name);

  constructor(
    private readonly db: Database,
    private readonly runtime: Runtime,
  ) {}

  async execute(executionId: string): Promise<void> {
    this.logger.log(`Starting execution ${executionId}`);

    const execution = await this.db.execution.findById(executionId);

    if (!execution) {
      throw new NotFoundException(`Execution '${executionId}' not found`);
    }

    if (!execution.workflowId) {
      throw new Error('Execution has no workflow');
    }

    const workflow = await this.db.workflow.findById(execution.workflowId);

    if (!workflow) {
      throw new NotFoundException(
        `Workflow '${execution.workflowId}' not found`,
      );
    }

    if (!workflow.definition) {
      throw new NotFoundException(
        `Workflow definitions '${execution.workflowId}' not found`,
      );
    }

    await this.db.execution.start(execution.id);

    try {
      const initialState = {
        workspaceId: execution.workspaceId,
        workflowId: workflow.id,
        threadId: execution.threadId ?? execution.id,
        variables: execution.variables ?? {},
        nodeResults: execution.nodeResults ?? {},
      };

      const result = await this.runtime.execute(
        workflow.definition,
        execution.input,
        initialState,
      );

      await this.db.execution.complete(execution.id, {
        variables: result.variables,
        nodeResults: result.nodeResults,
        output: result.output,
        finishedAt: new Date(),
      });

      this.logger.log(`Execution ${executionId} completed`);
    } catch (error) {
      await this.db.execution.fail(execution.id, {
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      });

      throw error;
    }
  }
}
