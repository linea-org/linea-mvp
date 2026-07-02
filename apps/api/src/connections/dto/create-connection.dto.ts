import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConnectionDto {
  @ApiProperty({
    description: 'Config value json string (stored encrypted, never returned)',
  })
  @IsString()
  @MinLength(1)
  config!: string;
}
