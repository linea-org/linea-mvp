import { Module } from '@nestjs/common';
import { ConnectionsModule } from '../../connections/connections.module.js';
import { AIService } from './ai.service.js';

@Module({
  imports: [ConnectionsModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
