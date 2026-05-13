import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GetMetricsDto {
  @ApiPropertyOptional({ enum: ['24h', '7d', '30d'], default: '7d' })
  @IsOptional()
  @IsEnum(['24h', '7d', '30d'])
  period?: '24h' | '7d' | '30d' = '7d';
}
