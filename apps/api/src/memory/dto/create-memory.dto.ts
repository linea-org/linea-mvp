import { IsString, IsOptional, IsIn, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMemoryDto {
  @ApiProperty({ enum: ['thread', 'workflow', 'user'] })
  @IsIn(['thread', 'workflow', 'user'])
  scope: 'thread' | 'workflow' | 'user';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  workflowId?: string;
}
