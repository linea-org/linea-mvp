import { Module, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ExecutionsService } from './executions.service';
import { ExecutionsController } from './executions.controller';
import { NodesController } from './nodes.controller';
import { ExecutionEventsService, EXEC_EVENTS_REDIS } from './execution-events.service';
import { ExecutionProcessor } from './queue/execution.processor';
import { CheckpointCleanupProcessor, CLEANUP_QUEUE } from './queue/checkpoint-cleanup.processor';
import { LangGraphService } from './engine/langgraph.service';
import { NodeExecutorService } from './engine/node-executor.service';
import { ExecutionSupervisor } from './engine/supervisor';
import { MemoryService } from './engine/memory.service';
import { CheckpointerService } from './engine/checkpointer.service';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PodsModule } from '../pods/pods.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QuotasModule } from '../quotas/quotas.module';
import { EXECUTION_QUEUE } from './queue/execution.queue';

@Module({
  imports: [
    WorkspacesModule,
    PodsModule,
    NotificationsModule,
    QuotasModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (!redisUrl) {
          return { connection: { host: 'localhost', port: 6379 } };
        }
        return { connection: { url: redisUrl } };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: EXECUTION_QUEUE }),
    BullModule.registerQueue({ name: CLEANUP_QUEUE }),
  ],
  providers: [
    {
      provide: EXEC_EVENTS_REDIS,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        return url ? new Redis(url) : new Redis({ host: 'localhost', port: 6379 });
      },
      inject: [ConfigService],
    },
    ExecutionsService,
    ExecutionEventsService,
    ExecutionProcessor,
    CheckpointCleanupProcessor,
    LangGraphService,
    NodeExecutorService,
    ExecutionSupervisor,
    MemoryService,
    CheckpointerService,
  ],
  controllers: [ExecutionsController, NodesController],
  exports: [ExecutionsService, NodeExecutorService, MemoryService, CheckpointerService],
})
export class ExecutionsModule implements OnModuleInit {
  constructor(
    @InjectQueue(CLEANUP_QUEUE) private readonly cleanupQueue: Queue,
  ) {}

  async onModuleInit() {
    // Schedule daily checkpoint cleanup; upsertJobScheduler is idempotent
    await this.cleanupQueue.upsertJobScheduler(
      'daily-checkpoint-cleanup',
      { every: 24 * 60 * 60 * 1000 },
      { name: 'checkpoint-cleanup' },
    );
  }
}
