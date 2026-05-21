import { IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReactCommentDto {
  @ApiProperty({ example: '👍' })
  @IsString()
  @MaxLength(8)
  emoji!: string;
}
