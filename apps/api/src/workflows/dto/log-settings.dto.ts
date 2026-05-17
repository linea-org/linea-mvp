import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLogSettingsDto {
  @ApiProperty({ enum: ['none', 'errors', 'info', 'debug'] })
  @IsEnum(['none', 'errors', 'info', 'debug'])
  logLevel: 'none' | 'errors' | 'info' | 'debug';

  @ApiPropertyOptional({ description: 'Days to keep logs (null = forever)', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  logRetentionDays?: number | null;
}
