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
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { WORKFLOW_NODE_CONFIG_DTOS } from './nodes/index.js';
import type { WorkflowNodeType } from '@linea/shared/contracts';

class WorkflowNodeDto {
  @IsString()
  id!: string;

  @IsIn(['agent', 'transform', 'http'])
  type!: WorkflowNodeType;

  @IsObject()
  position!: { x: number; y: number };

  @ValidateNested()
  @Type((options) => {
    const node = options?.object as WorkflowNodeDto;
    return WORKFLOW_NODE_CONFIG_DTOS[node.type];
  })
  data!: InstanceType<(typeof WORKFLOW_NODE_CONFIG_DTOS)[WorkflowNodeType]>;

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
  @IsString()
  startNode!: string;

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
  @IsObject()
  @ValidateNested()
  @Type(() => WorkflowDefinitionDto)
  definition!: WorkflowDefinitionDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isTemplate?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
