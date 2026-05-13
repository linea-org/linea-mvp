import { PartialType } from '@nestjs/mapped-types';
import { CreateMcpServerDto } from './create-mcp-server.dto';

export class UpdateMcpServerDto extends PartialType(CreateMcpServerDto) {}
