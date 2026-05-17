import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSecretDto {
  @ApiProperty({
    description: 'Secret name (uppercase, underscores, letters only)',
    example: 'OPENAI_API_KEY',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(/^[A-Z][A-Z0-9_]*$/, {
    message: 'Name must be uppercase letters, digits, and underscores',
  })
  name!: string;

  @ApiProperty({
    description: 'Secret value (stored encrypted, never returned)',
  })
  @IsString()
  @MinLength(1)
  value!: string;
}
