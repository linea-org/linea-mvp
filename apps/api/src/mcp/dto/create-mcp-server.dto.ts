import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';

export class CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  url: string;

  @IsOptional()
  @IsIn(['none', 'api_key', 'bearer', 'oauth'])
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth';

  @IsOptional()
  @IsString()
  accessToken?: string;
}
