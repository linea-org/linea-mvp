import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { workerConfigSchema } from '@linea/shared';
import { AIModule } from './ai/ai.module.js';
import { DatabaseModule } from './database/database.module.js';
import { QueueModule } from './queue/queue.module.js';
import { ExecutionProcessor } from './execution/execution.processor.js';
import { ExecutionWorker } from './execution/execution.worker.js';
import { RuntimeModule } from './runtime/runtime.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => workerConfigSchema.parse(config),
      envFilePath: ['../../.env', '.env'],
    }),
    DatabaseModule,
    AIModule,
    QueueModule,
    RuntimeModule,
  ],

  providers: [ExecutionProcessor, ExecutionWorker],
})
export class AppModule {}
