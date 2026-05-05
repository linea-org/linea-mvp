import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateMemberRoleDto {
  @ApiProperty({ enum: ['admin', 'editor', 'viewer'] })
  @IsEnum(['admin', 'editor', 'viewer'])
  role: 'admin' | 'editor' | 'viewer';
}
