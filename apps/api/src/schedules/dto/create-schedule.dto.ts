import {
  IsString,
  IsBoolean,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateScheduleDto {
  @ApiProperty()
  @IsUUID()
  workflowId!: string;

  @ApiProperty({ example: '0 * * * *' })
  @IsString()
  cronExpr!: string;

  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  input?: Record<string, unknown>;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  enabled?: boolean;
}
