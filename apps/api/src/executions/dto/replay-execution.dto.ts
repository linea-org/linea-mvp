import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ReplayExecutionDto {
  @ApiPropertyOptional({ description: 'Node ID to replay from. Omit to re-run from scratch.' })
  @IsOptional()
  @IsString()
  fromNodeId?: string;
}
