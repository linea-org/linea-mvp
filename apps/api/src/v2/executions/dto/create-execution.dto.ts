import { IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExecutionDto {
  @ApiProperty({ description: 'Workflow to execute' })
  @IsString()
  workflowId!: string;

  @ApiPropertyOptional({ description: 'Input variables for the workflow' })
  @IsObject()
  @IsOptional()
  input?: Record<string, any>;
}
