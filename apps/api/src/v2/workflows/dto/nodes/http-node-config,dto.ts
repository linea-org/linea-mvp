import { HttpNodeConfig } from '@linea/shared/contracts';
import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class HttpNodeConfigDto implements HttpNodeConfig {
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method!: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  @IsString()
  url!: string;

  @IsObject()
  headers!: Record<string, string>;

  @IsOptional()
  body?: unknown;
}
