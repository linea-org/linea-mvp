import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto.js';

export class ListExecutionsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  workflowId?: string;

  @ApiPropertyOptional({
    enum: [
      'queued',
      'running',
      'suspended',
      'completed',
      'failed',
      'cancelled',
    ],
  })
  @IsIn(['queued', 'running', 'suspended', 'completed', 'failed', 'cancelled'])
  @IsOptional()
  status?: string;
}
