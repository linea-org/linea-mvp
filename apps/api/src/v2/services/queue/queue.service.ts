import { EXECUTION_JOB, EXECUTION_QUEUE, ExecutionJob } from '@linea/queues';
import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  constructor(
    @Inject(EXECUTION_QUEUE)
    private readonly executionQueue: Queue<ExecutionJob>,
  ) {}

  async enqueueExecution(executionId: string) {
    return this.executionQueue.add(
      EXECUTION_JOB,
      {
        executionId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }

  async startEnqueuedExecution(executionId: string) {
    return this.executionQueue.add(
      EXECUTION_JOB,
      {
        executionId,
      },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
  }
}
