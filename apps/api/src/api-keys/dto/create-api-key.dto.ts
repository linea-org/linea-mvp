import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ description: 'Human-readable label for this key' })
  @IsString()
  @IsOptional()
  label?: string;
}
