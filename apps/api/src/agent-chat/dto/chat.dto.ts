import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AIProviderType } from 'src/common/utils/config-types';

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
  @IsOptional()
  model!: string;

  @IsString()
  provider!: AIProviderType;

  @IsString()
  @IsOptional()
  threadId?: string;
}
