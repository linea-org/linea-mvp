import { IsOptional, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class ListWorkflowsDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by template flag' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isTemplate?: boolean;

  @ApiPropertyOptional({ description: 'Search by name (partial)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Show trashed (soft-deleted) workflows' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  trashed?: boolean;

  @ApiPropertyOptional({ description: 'Show only starred workflows' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  starred?: boolean;

  @ApiPropertyOptional({
    description: 'Show only workflows favorited by the current user',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  favorited?: boolean;
}
