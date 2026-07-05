import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { WorkflowService } from './workflow.service.js';
import { CreateWorkflowDto } from './dto/create-workflow.dto.js';
import { UpdateWorkflowDto } from './dto/update-workflow.dto.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '@linea/db';
import { ListWorkflowsDto } from './dto/list-workflows.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { PodGuard } from '../common/guards/pod.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller({
  path: 'workspaces/:workspaceId/pods/:podId/workflows',
  version: '2',
})
export class WorkflowController {
  constructor(private readonly service: WorkflowService) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.service.create(workspaceId, podId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List workflows' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(
    @Param('podId') podId: string,
    @Query() query: ListWorkflowsDto,
    @CurrentUser() user: User,
  ): any {
    return this.service.findAll(podId, query, user.id);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.service.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.service.remove(id, user.id);
  }
}
