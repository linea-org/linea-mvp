import type { ChatMessage, ToolDefinition } from '@linea/types';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AI_PROVIDERS, type AIProviderType } from '@linea/shared';
import { AgentNodeConfig } from '@linea/shared/contracts';

export class AgentNodeConfigDto implements AgentNodeConfig {
  @IsEnum(AI_PROVIDERS)
  provider!: AIProviderType;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @ValidateNested({ each: true })
  messages!: ChatMessage[];

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools!: ToolDefinition[];
}
