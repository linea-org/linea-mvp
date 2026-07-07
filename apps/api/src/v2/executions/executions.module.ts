import { Module } from '@nestjs/common';
import { ExecutionsService } from './executions.service.js';
import { ExecutionsController } from './executions.controller.js';
import { ExecutionEventsService } from './execution-events.service.js';

import { PodsModule } from '../pods/pods.module.js';
import { WorkspacesModule } from '../workspace/workspaces.module.js';
import { QueueModule } from '../services/queue/queue.module.js';
import { QueueService } from '../services/queue/queue.service.js';

@Module({
  imports: [WorkspacesModule, PodsModule, QueueModule],
  providers: [
    // {
    //   provide: EXEC_EVENTS_REDIS,
    //   useFactory: (config: ConfigService) => {
    //     const url = config.get<string>('REDIS_URL');
    //     return url
    //       ? new Redis(url)
    //       : new Redis({ host: 'localhost', port: 6379 });
    //   },
    //   inject: [ConfigService],
    // },
    ExecutionsService,
    ExecutionEventsService,
    QueueService,
    // CheckpointCleanupProcessor,
    // LangGraphService,
    // NodeExecutorService,
    // ExecutionSupervisor,
    // MemoryService,
    // CheckpointerService,
  ],
  controllers: [ExecutionsController],
  exports: [
    ExecutionsService,
    // NodeExecutorService,
    // MemoryService,
    // CheckpointerService,
  ],
})

// implements OnModuleInit
export class ExecutionsModule {
  // constructor(
  //   @InjectQueue(CLEANUP_QUEUE) private readonly cleanupQueue: Queue,
  // ) {}
  // async onModuleInit() {
  //   // Schedule daily checkpoint cleanup; upsertJobScheduler is idempotent
  //   await this.cleanupQueue.upsertJobScheduler(
  //     'daily-checkpoint-cleanup',
  //     { every: 24 * 60 * 60 * 1000 },
  //     { name: 'checkpoint-cleanup' },
  //   );
  // }
}
