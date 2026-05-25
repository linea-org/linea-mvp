import { IsString, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import type { KnowledgeBaseSettings } from '@linea/db';

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
    description: 'Per-KB RAG settings (chunk size, overlap, similarity threshold, etc.)',
  })
  @IsOptional()
  @IsObject()
  settings?: KnowledgeBaseSettings;
}
