import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNumber,
  MinLength,
  MaxLength,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsString()
  type!: string;

  @IsObject()
  position!: { x: number; y: number };

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  style?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  extent?: string;

  @IsOptional()
  @IsNumber()
  zIndex?: number;
}

class WorkflowEdgeDto {
  @IsString()
  id!: string;

  @IsString()
  source!: string;

  @IsString()
  target!: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class WorkflowSettingsDto {
  @IsOptional()
  maxIterations?: number;

  @IsOptional()
  timeout?: number;

  @IsOptional()
  maxTokens?: number;

  @IsOptional()
  snapToGrid?: boolean;

  @IsOptional()
  @IsString()
  webhookOnSuccess?: string;

  @IsOptional()
  @IsString()
  webhookOnFailure?: string;

  @IsOptional()
  @IsArray()
  testCases?: unknown[];
}

export class WorkflowDefinitionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeDto)
  nodes!: WorkflowNodeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeDto)
  edges!: WorkflowEdgeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkflowSettingsDto)
  settings?: WorkflowSettingsDto;
}

export class CreateWorkflowDto {
  @ApiProperty({ example: 'My Agent Workflow' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition?: WorkflowDefinitionDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
