import { ExecutionJob } from '@linea/queues';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutionProcessor } from './execution.processor.js';

@Injectable()
export class ExecutionWorker {
  constructor(private readonly processor: ExecutionProcessor) {}

  async process(job: Job<ExecutionJob>) {
    await this.processor.execute(job.data.executionId);
  }
}
