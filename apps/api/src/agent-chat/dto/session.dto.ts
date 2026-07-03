import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpsertSessionDto {
  @IsString()
  threadId!: string;

  @IsString()
  title!: string;

  @IsArray()
  messages!: unknown[];
}

export class PatchSessionDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsArray()
  @IsOptional()
  messages?: unknown[];
}
