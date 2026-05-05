import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListMemoriesDto {
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
