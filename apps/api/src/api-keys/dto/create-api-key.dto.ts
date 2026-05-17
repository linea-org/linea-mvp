import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiPropertyOptional({ description: 'Human-readable label for this key' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({
    description: 'Expiry duration: 30d, 90d, 365d, or never (default: never)',
    enum: ['30d', '90d', '365d', 'never'],
  })
  @IsIn(['30d', '90d', '365d', 'never'])
  @IsOptional()
  expiresIn?: '30d' | '90d' | '365d' | 'never';
}
