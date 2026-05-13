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
import { PodsService } from './pods.service';
import { CreatePodDto } from './dto/create-pod.dto';
import { UpdatePodDto } from './dto/update-pod.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Pods')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods')
export class PodsController {
  constructor(private readonly service: PodsService) {}

  @Post()
  @RequireRole('admin')
  @ApiOperation({ summary: 'Create a pod (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @Body() dto: CreatePodDto,
  ) {
    return this.service.create(workspaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List pods in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Get(':podId')
  @ApiOperation({ summary: 'Get a pod' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('podId') podId: string) {
    return this.service.findOne(workspaceId, podId);
  }

  @Patch(':podId')
  @RequireRole('admin')
  @ApiOperation({ summary: 'Update a pod (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @Body() dto: UpdatePodDto,
  ) {
    return this.service.update(workspaceId, podId, dto);
  }

  @Delete(':podId')
  @HttpCode(204)
  @RequireRole('admin')
  @ApiOperation({ summary: 'Delete a pod (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  delete(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
  ) {
    return this.service.delete(workspaceId, podId);
  }
}
