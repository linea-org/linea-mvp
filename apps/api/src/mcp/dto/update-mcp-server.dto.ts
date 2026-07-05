import { PartialType } from '@nestjs/mapped-types';
import { CreateMcpServerDto } from './create-mcp-server.dto.js';

export class UpdateMcpServerDto extends PartialType(CreateMcpServerDto) {}
