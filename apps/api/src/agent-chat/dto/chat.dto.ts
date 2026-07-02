import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AI_PROVIDERS, AIProviderType } from '../../common/utils/config-types';

export class ChatMessage {
  @IsString()
  role!: 'user' | 'assistant';

  @IsString()
  content!: string;
}

export class ChatContextDto {
  @IsString()
  @IsOptional()
  podId?: string;

  @IsString()
  @IsOptional()
  podName?: string;
}

export class ChatDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessage)
  messages!: ChatMessage[];

  @IsObject()
  @IsOptional()
  @ValidateNested()
  @Type(() => ChatContextDto)
  context?: ChatContextDto;

  @IsString()
  model!: string;

  @IsString()
  @IsIn(AI_PROVIDERS)
  provider!: AIProviderType;

  @IsString()
  @IsOptional()
  threadId?: string;
}
