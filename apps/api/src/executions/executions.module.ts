import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExecutionsService } from './executions.service';
import { ExecutionsController } from './executions.controller';
import { NodesController } from './nodes.controller';
import { ExecutionEventsService } from './execution-events.service';
import { ExecutionProcessor } from './queue/execution.processor';
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
  ],
  providers: [
    ExecutionsService,
    ExecutionEventsService,
    ExecutionProcessor,
    LangGraphService,
    NodeExecutorService,
    ExecutionSupervisor,
    MemoryService,
    CheckpointerService,
  ],
  controllers: [ExecutionsController, NodesController],
  exports: [ExecutionsService, NodeExecutorService],
})
export class ExecutionsModule {}
