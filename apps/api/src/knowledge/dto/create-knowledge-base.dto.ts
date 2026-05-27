import { IsString, IsOptional, IsObject, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { KnowledgeBaseSettings } from '@linea/db';

export class CreateKnowledgeBaseDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Per-KB RAG settings (chunk size, overlap, similarity threshold, etc.)',
    example: { chunkSize: 1800, chunkOverlap: 360, similarityThreshold: 0.75 },
  })
  @IsOptional()
  @IsObject()
  settings?: KnowledgeBaseSettings;
}
