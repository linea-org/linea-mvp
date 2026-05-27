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
  Res,
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { WorkflowsService } from './workflows.service';
import { GenerateWorkflowService } from './generate-workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ListWorkflowsDto } from './dto/list-workflows.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { GenerateWorkflowDto } from './dto/generate-workflow.dto';
import { PublishTemplateDto, UpdateTemplateDto } from './dto/publish-template.dto';
import { UpdateLogSettingsDto } from './dto/log-settings.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { GlobalAdminGuard } from '../common/guards/global-admin.guard';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';
import { AuditService } from '../audit/audit.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/workflows')
export class WorkflowsController {
  constructor(
    private readonly service: WorkflowsService,
    private readonly generateService: GenerateWorkflowService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateWorkflowDto,
  ) {
    const result = await this.service.create(podId, user.id, dto);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'workflow.create',
      resourceType: 'workflow',
      resourceId: result.id,
      resourceName: result.name,
    });
    return result;
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(
    @Param('podId') podId: string,
    @Query() query: ListWorkflowsDto,
    @CurrentUser() user: User,
  ) {
    return this.service.findAll(podId, query, user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.findOne(podId, id);
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.service.update(podId, id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Delete a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.service.delete(podId, id);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'workflow.delete',
      resourceType: 'workflow',
      resourceId: id,
    });
    return result;
  }

  @Post(':id/presence')
  @HttpCode(200)
  @ApiOperation({ summary: 'Upsert presence and return other active users' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  upsertPresence(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.upsertPresence(id, user.id);
  }

  @Post(':id/duplicate')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Duplicate a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  duplicate(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.duplicate(podId, id, user.id);
  }

  @Post(':id/deploy')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Mark a workflow as deployed (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  deploy(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.deploy(podId, id);
  }

  @Post(':id/undeploy')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Unpublish a deployed workflow (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  undeploy(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.undeploy(podId, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'List version history of a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  getVersions(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.getVersions(podId, id);
  }

  @Get(':id/versions/:version')
  @ApiOperation({ summary: 'Get a specific workflow version' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'version', type: Number })
  getVersion(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.service.getVersion(podId, id, version);
  }

  @Post(':id/versions/:version/restore')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Restore workflow to a previous version' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'version', type: Number })
  restoreVersion(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Param('version', ParseIntPipe) version: number,
    @CurrentUser() user: User,
  ) {
    return this.service.restoreVersion(podId, id, version, user.id);
  }

  @Patch(':id/star')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Star or unstar a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  star(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() body: { starred: boolean },
  ) {
    return this.service.star(podId, id, body.starred);
  }

  @Patch(':id/trash')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Move a workflow to trash (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  trash(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.trash(podId, id);
  }

  @Patch(':id/restore')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Restore a workflow from trash (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  restore(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.restore(podId, id);
  }

  @Delete(':id/permanent')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Permanently delete a trashed workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  hardDelete(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.hardDelete(podId, id);
  }

  @Patch(':id/template')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Mark or unmark a workflow as a pod template (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  setTemplate(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() body: { isTemplate: boolean },
  ) {
    return this.service.setTemplate(podId, id, body.isTemplate);
  }

  @Post(':id/favorite')
  @HttpCode(204)
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Add a workflow to personal favorites' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  favoriteWorkflow(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.favoriteWorkflow(user.id, id);
  }

  @Delete(':id/favorite')
  @HttpCode(204)
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Remove a workflow from personal favorites' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  unfavoriteWorkflow(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.unfavoriteWorkflow(user.id, id);
  }

  @Get('me/favorites')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get IDs of workflows favorited by current user in this pod' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  getWorkflowFavoriteIds(
    @Param('podId') podId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.getWorkflowFavoriteIds(user.id, podId);
  }

  @Post(':id/publish')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Publish a workflow to the public gallery (workspace admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  publishToGallery(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: PublishTemplateDto,
  ) {
    return this.service.publishToGallery(podId, id, user.id, dto);
  }

  @Patch(':id/log-settings')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Update log collection settings for a workflow (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  updateLogSettings(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() dto: UpdateLogSettingsDto,
  ) {
    return this.service.updateLogSettings(podId, id, dto);
  }

  @Post('from-template/:templateId')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Clone a template into this pod (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'templateId' })
  createFromTemplate(
    @Param('podId') podId: string,
    @Param('templateId') templateId: string,
    @CurrentUser() user: User,
    @Body() body: { name?: string },
  ) {
    return this.service.createFromTemplate(podId, user.id, templateId, body.name);
  }

  @Post(':id/generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @RequireRole('editor')
  @ApiOperation({
    summary: 'Generate workflow from natural language (SSE stream, editor+)',
  })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  async generate(
    @Param('id') _id: string,
    @Body() dto: GenerateWorkflowDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const abort = new AbortController();
    req.on('close', () => abort.abort());

    const gen = this.generateService.generate(dto.prompt, abort.signal, dto.canvasContext, dto.history);
    try {
      for await (const event of gen) {
        if (abort.signal.aborted) break;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } catch (err) {
      if (!abort.signal.aborted) {
        res.write(
          `data: ${JSON.stringify({ type: 'error', message: err instanceof Error ? err.message : String(err) })}\n\n`,
        );
      }
    } finally {
      await gen.return(undefined);
      res.end();
    }
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
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'featured', required: false })
  listTemplates(@Query() query: ListTemplatesDto) {
    return this.service.listTemplates(query);
  }

  @Get('me/upvoted')
  @UseGuards(ClerkAuthGuard)
  @ApiOperation({ summary: 'Get template IDs the current user has upvoted' })
  getUserUpvotedIds(@CurrentUser() user: User) {
    return this.service.getUserUpvotedTemplateIds(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single template (increments view count)' })
  @ApiParam({ name: 'id' })
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id, true);
  }

  @Post(':id/upvote')
  @UseGuards(ClerkAuthGuard)
  @ApiOperation({ summary: 'Toggle upvote on a template' })
  @ApiParam({ name: 'id' })
  toggleUpvote(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.toggleTemplateUpvote(user.id, id);
  }

  @Patch(':id')
  @UseGuards(ClerkAuthGuard, GlobalAdminGuard)
  @ApiOperation({ summary: 'Update a gallery template (platform admin only)' })
  @ApiParam({ name: 'id' })
  updateTemplate(@Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.service.updateGalleryTemplate(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ClerkAuthGuard, GlobalAdminGuard)
  @ApiOperation({ summary: 'Delete a gallery template (platform admin only)' })
  @ApiParam({ name: 'id' })
  deleteTemplate(@Param('id') id: string) {
    return this.service.deleteGalleryTemplate(id);
  }
}
