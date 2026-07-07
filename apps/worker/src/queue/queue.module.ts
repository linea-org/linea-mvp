import {
  createConnection,
  QUEUES,
  createQueue,
  ExecutionJob,
  REDIS,
  EXECUTION_QUEUE,
} from '@linea/queues';
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createConnection({
          url: config.getOrThrow('REDIS_URL'),
        }),
    },
    {
      provide: EXECUTION_QUEUE,
      inject: [REDIS],
      useFactory: (redis: Redis) =>
        createQueue<ExecutionJob>(QUEUES.EXECUTION, {
          connection: redis,
        }),
    },
  ],
  exports: [REDIS, EXECUTION_QUEUE],
})
export class QueueModule {}
