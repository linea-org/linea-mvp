import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { WorkflowsService } from './workflows.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ListWorkflowsDto } from './dto/list-workflows.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { SpaceGuard } from '../common/guards/space.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceMembership } from '../common/decorators/workspace-membership.decorator';
import type { User, WorkspaceMember } from '@linea/db';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, SpaceGuard)
@Controller('workspaces/:workspaceId/spaces/:spaceId/workflows')
export class WorkflowsController {
  constructor(private readonly service: WorkflowsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  create(
    @Param('spaceId') spaceId: string,
    @CurrentUser() user: User,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.service.create(spaceId, user.id, membership, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  findAll(
    @Param('spaceId') spaceId: string,
    @Query() query: ListWorkflowsDto,
  ) {
    return this.service.findAll(spaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.findOne(spaceId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.service.update(spaceId, id, membership, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  delete(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.delete(spaceId, id, membership);
  }

  @Post(':id/deploy')
  @ApiOperation({ summary: 'Mark a workflow as deployed (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  deploy(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.deploy(spaceId, id, membership);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List version history of a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  getVersions(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.getVersions(spaceId, id);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get a specific workflow version' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'version', type: Number })
  getVersion(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getVersion(spaceId, id, version);
  }

  @Patch(':id/star')
  @ApiOperation({ summary: 'Star or unstar a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  star(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body() body: { starred: boolean },
  ) {
    return this.service.star(spaceId, id, body.starred);
  }

  @Patch(':id/trash')
  @ApiOperation({ summary: 'Move a workflow to trash (soft delete)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  trash(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.trash(spaceId, id, membership);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Restore a workflow from trash' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  restore(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.restore(spaceId, id, membership);
  }

  @Post('from-template/:templateId')
  @ApiOperation({ summary: 'Clone a template into this space (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'templateId' })
  createFromTemplate(
    @Param('spaceId') spaceId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: User,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.createFromTemplate(spaceId, user.id, membership, templateId);
  }
}

// ─── Public templates route (no workspace scope) ──────────────────────────────

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
export class TemplatesController {
  constructor(private readonly service: WorkflowsService) {}

  @Get()
  @ApiOperation({ summary: 'List public templates' })
  @ApiQuery({ name: 'search', required: false })
  listTemplates(@Query() query: ListWorkflowsDto) {
    return this.service.listTemplates(query);
  }
}
