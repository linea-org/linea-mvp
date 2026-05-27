import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MemoryModule } from '../memory/memory.module';
import { KnowledgeService } from './knowledge.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeEmbedProcessor } from './knowledge.processor';
import { AuditModule } from '../audit/audit.module';
import { RAG_EMBED_QUEUE } from './knowledge.queue';

@Module({
  imports: [
    MemoryModule,
    AuditModule,
    BullModule.registerQueue({ name: RAG_EMBED_QUEUE }),
  ],
  providers: [KnowledgeService, KnowledgeEmbedProcessor],
  controllers: [KnowledgeController],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
