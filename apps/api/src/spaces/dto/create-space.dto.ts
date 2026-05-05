import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSpaceDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}
