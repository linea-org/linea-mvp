import { IsEmail, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ enum: ['admin', 'editor', 'viewer'], default: 'editor' })
  @IsEnum(['admin', 'editor', 'viewer'])
  role: 'admin' | 'editor' | 'viewer' = 'editor';
}
