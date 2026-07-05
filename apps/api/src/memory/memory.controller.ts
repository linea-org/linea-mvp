import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MemoryService } from './memory.service.js';
import { CreateMemoryDto } from './dto/create-memory.dto.js';
import { ListMemoriesDto } from './dto/list-memories.dto.js';
import { IngestMemoryDto } from './dto/ingest-memory.dto.js';
import { SearchMemoryDto } from './dto/search-memory.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import type { User } from '@linea/db';

@ApiTags('Memory')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/memories')
export class MemoryController {
  constructor(private readonly service: MemoryService) {}

  @Post('ingest')
  @RequireRole('editor')
  @ApiOperation({
    summary:
      'Ingest text — extracts atomic facts with embeddings and conflict resolution (editor+)',
  })
  @ApiParam({ name: 'workspaceId' })
  ingest(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: IngestMemoryDto,
  ) {
    return this.service.ingest(workspaceId, user.id, dto);
  }

  @Post('search')
  @ApiOperation({
    summary: 'Hybrid search: pgvector cosine + keyword, merged score',
  })
  @ApiParam({ name: 'workspaceId' })
  search(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SearchMemoryDto,
  ) {
    return this.service.search(workspaceId, dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'User memory profile grouped by factType' })
  @ApiParam({ name: 'workspaceId' })
  getProfile(
    @Param('workspaceId') workspaceId: string,
    @Query('userId') userId: string,
  ) {
    return this.service.getProfile(workspaceId, userId);
  }

  @Post()
  @RequireRole('editor')
  @ApiOperation({
    summary: 'Store a memory manually (no extraction) (editor+)',
  })
  @ApiParam({ name: 'workspaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateMemoryDto,
  ) {
    return this.service.create(workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List memories (filterable by scope, threadId, workflowId)',
  })
  @ApiParam({ name: 'workspaceId' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query() query: ListMemoriesDto,
  ) {
    return this.service.findAll(workspaceId, query);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Delete a memory (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.delete(workspaceId, id);
  }
}
