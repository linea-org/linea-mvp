import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { EmbeddingService } from './embedding.service';
import { ExtractionService } from './extraction.service';

@Module({
  imports: [ConfigModule],
  providers: [MemoryService, EmbeddingService, ExtractionService],
  controllers: [MemoryController],
  exports: [MemoryService, EmbeddingService, ExtractionService],
})
export class MemoryModule {}
