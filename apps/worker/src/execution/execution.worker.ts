import {
  Inject,
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';

import { REDIS, QUEUES, createWorker } from '@linea/queues';
import { ExecutionProcessor } from './execution.processor.js';

@Injectable()
export class ExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private worker!: Worker;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly processor: ExecutionProcessor,
  ) {}

  onModuleInit() {
    this.worker = createWorker(
      QUEUES.EXECUTION,
      async (job) => {
        await this.processor.execute(job.data.executionId);
      },
      {
        connection: this.redis,
      },
    );
  }

  async onModuleDestroy() {
    await this.worker.close();
  }
}
