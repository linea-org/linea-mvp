import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  createConnection,
  createQueue,
  EXECUTION_QUEUE,
  QUEUES,
  REDIS,
} from '@linea/queues';
import { QueueService } from './queue.service.js';
import { Redis } from 'ioredis';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createConnection({
          url: config.get<string>('REDIS_URL') || '',
        }),
    },
    {
      provide: EXECUTION_QUEUE,
      inject: [REDIS],
      useFactory: (redis: Redis) =>
        createQueue(QUEUES.EXECUTION, {
          connection: redis,
        }),
    },
    QueueService,
  ],
  exports: [REDIS, EXECUTION_QUEUE, QueueService],
})
export class QueueModule {}
