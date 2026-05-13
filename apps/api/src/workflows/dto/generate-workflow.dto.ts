import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GenerateWorkflowDto {
  @ApiProperty({ description: 'Natural-language description of the workflow to generate' })
  @IsString()
  @MinLength(10)
  @MaxLength(2000)
  prompt: string;
}
