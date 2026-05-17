import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchMemoryDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  query: string;

  @ApiPropertyOptional({ enum: ['thread', 'workflow', 'user'] })
  @IsOptional()
  @IsIn(['thread', 'workflow', 'user'])
  scope?: 'thread' | 'workflow' | 'user';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  threadId?: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number;
}
