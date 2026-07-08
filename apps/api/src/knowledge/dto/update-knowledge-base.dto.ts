import {
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { KnowledgeBaseSettings } from '@linea/db';

// embeddingModel is deliberately absent — it's locked at creation and rejected via forbidNonWhitelisted
export class UpdateKnowledgeBaseDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Per-KB RAG settings (chunk size, overlap, similarity threshold, etc.)',
  })
  @IsOptional()
  @IsObject()
  settings?: KnowledgeBaseSettings;
}
