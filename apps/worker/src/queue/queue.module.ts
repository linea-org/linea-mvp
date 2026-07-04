import { Module } from '@nestjs/common';
import { ExecutionConsumer } from './execution.module';

@Module({
  providers: [ExecutionConsumer],
})
export class QueueModule {}
