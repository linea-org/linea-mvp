import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MemoryModule } from '../memory/memory.module.js';
import { KnowledgeService } from './knowledge.service.js';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeEmbedProcessor } from './knowledge.processor.js';
import { AuditModule } from '../audit/audit.module.js';
import { RAG_EMBED_QUEUE } from './knowledge.queue.js';
import { AIModule } from '../services/ai/ai.module.js';

@Module({
  imports: [
    MemoryModule,
    AuditModule,
    BullModule.registerQueue({ name: RAG_EMBED_QUEUE }),
    AIModule,
  ],
  providers: [KnowledgeService, KnowledgeEmbedProcessor],
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
