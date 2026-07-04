import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { ExtractionService } from './extraction.service';
import { AIModule } from 'src/services/ai/ai.module';

@Module({
  imports: [ConfigModule, AIModule],
  providers: [MemoryService, ExtractionService],
  controllers: [MemoryController],
  exports: [MemoryService, ExtractionService],
})
export class MemoryModule {}
