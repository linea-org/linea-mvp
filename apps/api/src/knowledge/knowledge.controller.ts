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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service.js';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto.js';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto.js';
import { CreateEntryDto } from './dto/create-entry.dto.js';
import { SearchEntriesDto } from './dto/search-entries.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuditService } from '../audit/audit.service.js';
import type { User } from '@linea/db';

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/knowledge-bases')
export class KnowledgeController {
  constructor(
    private readonly service: KnowledgeService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a knowledge base (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateKnowledgeBaseDto,
  ) {
    const kb = await this.service.createBase(workspaceId, dto);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'kb.create',
      resourceType: 'knowledge_base',
      resourceId: kb.id,
      resourceName: kb.name,
    });
    return kb;
  }

  @Get()
  @ApiOperation({ summary: 'List knowledge bases with entry counts' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.listBases(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a knowledge base' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.getBase(workspaceId, id);
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update a knowledge base (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.service.updateBase(workspaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({
    summary: 'Delete a knowledge base and all its entries (editor+)',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const kb = await this.service.getBase(workspaceId, id);
    await this.service.deleteBase(workspaceId, id);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'kb.delete',
      resourceType: 'knowledge_base',
      resourceId: id,
      resourceName: kb.name,
    });
  }

  @Post(':id/entries')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Add an entry to a knowledge base (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  addEntry(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
    @Body() dto: CreateEntryDto,
  ) {
    return this.service.addEntry(workspaceId, kbId, dto);
  }

  @Get(':id/entries')
  @ApiOperation({ summary: 'List entries in a knowledge base' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  listEntries(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
  ) {
    return this.service.listEntries(workspaceId, kbId);
  }

  @Get(':id/entries/:entryId/status')
  @ApiOperation({ summary: 'Get ingestion status for a single entry' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'entryId' })
  getEntryStatus(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.getEntryStatus(workspaceId, kbId, entryId);
  }

  @Post(':id/entries/:entryId/retry')
  @RequireRole('editor')
  @ApiOperation({
    summary: 'Re-enqueue a failed entry for embedding (editor+)',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'entryId' })
  retryEntry(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.retryEntry(workspaceId, kbId, entryId);
  }

  @Delete(':id/entries/:entryId')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Delete an entry (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'entryId' })
  deleteEntry(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.service.deleteEntry(workspaceId, kbId, entryId);
  }

  @Post(':id/search')
  @ApiOperation({
    summary:
      'Search entries by text (semantic search when embeddings available)',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  search(
    @Param('workspaceId') workspaceId: string,
    @Param('id') kbId: string,
    @Body() dto: SearchEntriesDto,
  ) {
    return this.service.searchEntries(workspaceId, kbId, dto);
  }
}
