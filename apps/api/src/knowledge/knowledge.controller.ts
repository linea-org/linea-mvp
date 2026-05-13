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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import { CreateEntryDto } from './dto/create-entry.dto';
import { SearchEntriesDto } from './dto/search-entries.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

@ApiTags('Knowledge')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/knowledge-bases')
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a knowledge base (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  create(@Param('workspaceId') workspaceId: string, @Body() dto: CreateKnowledgeBaseDto) {
    return this.service.createBase(workspaceId, dto);
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
  @ApiOperation({ summary: 'Delete a knowledge base and all its entries (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('workspaceId') workspaceId: string, @Param('id') id: string) {
    return this.service.deleteBase(workspaceId, id);
  }

  // ─── Entries ────────────────────────────────────────────────────────────────

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
  listEntries(@Param('workspaceId') workspaceId: string, @Param('id') kbId: string) {
    return this.service.listEntries(workspaceId, kbId);
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
  @ApiOperation({ summary: 'Search entries by text (semantic search when embeddings available)' })
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
