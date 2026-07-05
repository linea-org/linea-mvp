import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service.js';
import { MemoryController } from './memory.controller.js';
import { ExtractionService } from './extraction.service.js';
import { AIModule } from '../services/ai/ai.module.js';

@Module({
  imports: [ConfigModule, AIModule],
  providers: [MemoryService, ExtractionService],
  controllers: [MemoryController],
  exports: [MemoryService, ExtractionService],
})
export class MemoryModule {}
