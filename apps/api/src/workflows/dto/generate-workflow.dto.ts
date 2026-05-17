import { IsString, IsOptional, MinLength, MaxLength, IsArray, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GenerateWorkflowDto {
  @ApiProperty({
    description: 'Natural-language description of the workflow to generate or edit',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt: string;

  @ApiPropertyOptional({ description: 'Current canvas state for context-aware editing' })
  @IsOptional()
  @IsObject()
  canvasContext?: {
    nodeCount: number;
    nodeTypes: string[];
    nodeLabels: string[];
  };

  @ApiPropertyOptional({ description: 'Conversation history for multi-turn generation' })
  @IsOptional()
  @IsArray()
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
