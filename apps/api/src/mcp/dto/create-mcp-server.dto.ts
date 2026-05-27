import { IsString, IsNotEmpty, IsOptional, IsIn, IsUrl } from 'class-validator';

export class CreateMcpServerDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
  })
  url: string;

  @IsOptional()
  @IsIn(['none', 'api_key', 'bearer', 'oauth'])
  authType?: 'none' | 'api_key' | 'bearer' | 'oauth';

  @IsOptional()
  @IsString()
  accessToken?: string;
}
