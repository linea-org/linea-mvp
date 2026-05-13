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
import { SkipThrottle } from '@nestjs/throttler';
import { WorkflowsService } from './workflows.service';
import { GenerateWorkflowService } from './generate-workflow.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ListWorkflowsDto } from './dto/list-workflows.dto';
import { ListTemplatesDto } from './dto/list-templates.dto';
import { GenerateWorkflowDto } from './dto/generate-workflow.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/workflows')
export class WorkflowsController {
  constructor(
    private readonly service: WorkflowsService,
    private readonly generateService: GenerateWorkflowService,
  ) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  create(
    @Param('podId') podId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.service.create(podId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(@Param('podId') podId: string, @Query() query: ListWorkflowsDto) {
    return this.service.findAll(podId, query);
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
  delete(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.delete(podId, id);
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
  ) {
    return this.service.createFromTemplate(podId, user.id, templateId);
  }

  @Post(':id/generate')
  @SkipThrottle()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Generate workflow from natural language (SSE stream, editor+)' })
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

    const gen = this.generateService.generate(dto.prompt, abort.signal);
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
}
