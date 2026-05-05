import { IsString, IsOptional, IsObject, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEntryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
