import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createConnection, createQueue, QUEUES } from '@linea/queues';

export const REDIS = Symbol('REDIS');
export const EXECUTION_QUEUE = Symbol('EXECUTION_QUEUE');

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
      useFactory: (redis: ReturnType<typeof createConnection>) =>
        createQueue(QUEUES.EXECUTION, {
          connection: redis,
        }),
    },
  ],
  exports: [REDIS, EXECUTION_QUEUE],
})
export class QueueModule {}
