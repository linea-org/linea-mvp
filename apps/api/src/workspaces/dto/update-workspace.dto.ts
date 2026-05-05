import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name?: string;

  @ApiPropertyOptional({ example: 'acme-corp' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  slug?: string;
}
