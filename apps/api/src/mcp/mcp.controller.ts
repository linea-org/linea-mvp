import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { McpService } from './mcp.service';
import { CreateMcpServerDto } from './dto/create-mcp-server.dto';
import { UpdateMcpServerDto } from './dto/update-mcp-server.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/mcp-servers')
export class McpController {
  constructor(private readonly service: McpService) {}

  @Post()
  @RequireRole('editor')
  create(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateMcpServerDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Get()
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Get(':id')
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.findOne(workspaceId, id);
  }

  @Patch(':id')
  @RequireRole('editor')
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMcpServerDto,
  ) {
    return this.service.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.delete(workspaceId, id);
  }
}
