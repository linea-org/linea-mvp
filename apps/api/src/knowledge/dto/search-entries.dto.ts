import { IsString, IsOptional, IsInt, Min, Max, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchEntriesDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  query: string;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  @Transform(({ value }) => parseInt(value as string, 10))
  limit: number = 10;
}
