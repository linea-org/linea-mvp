import { IsArray, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceSettingsDto {
  @ApiPropertyOptional({ description: 'Ordered list of model IDs to try when the primary fails', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modelFallbackChain?: string[];

  @ApiPropertyOptional({ description: 'Cosine distance threshold for RAG retrieval (0.0–1.0)', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  ragSimilarityThreshold?: number;

  @ApiPropertyOptional({ description: 'Characters per knowledge chunk', minimum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(100)
  ragChunkSize?: number;

  @ApiPropertyOptional({ description: 'Overlap between consecutive chunks', minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ragChunkOverlap?: number;
}
