import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateScheduleDto {
  @ApiPropertyOptional({ example: '0 * * * *' })
  @IsString()
  @IsOptional()
  cronExpr?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  input?: Record<string, unknown>;
}
