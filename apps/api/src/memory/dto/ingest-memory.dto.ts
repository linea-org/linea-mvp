import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IngestMemoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ enum: ['thread', 'workflow', 'user'] })
  @IsOptional()
  @IsIn(['thread', 'workflow', 'user'])
  scope?: 'thread' | 'workflow' | 'user';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;
}
