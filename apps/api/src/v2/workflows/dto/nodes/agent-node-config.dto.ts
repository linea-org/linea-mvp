import type { ChatMessage, ToolDefinition } from '@linea/types';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { AI_PROVIDERS, type AIProviderType } from '@linea/shared';
import { AgentNodeConfig } from '@linea/shared/contracts';

export class AgentNodeConfigDto implements AgentNodeConfig {
  @IsOptional()
  @IsArray()
  messages: ChatMessage[] = [];

  @IsEnum(AI_PROVIDERS)
  provider!: AIProviderType;

  @IsString()
  model!: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

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
