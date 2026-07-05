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
import { SchedulesService } from './schedules.service.js';
import { CreateScheduleDto } from './dto/create-schedule.dto.js';
import { UpdateScheduleDto } from './dto/update-schedule.dto.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { PodGuard } from '../common/guards/pod.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { AuditService } from '../audit/audit.service.js';
import type { User } from '@linea/db';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/schedules')
export class SchedulesController {
  constructor(
    private readonly service: SchedulesService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Create a cron schedule (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  async create(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateScheduleDto,
  ) {
    const schedule = await this.service.create(podId, dto);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'schedule.create',
      resourceType: 'schedule',
      resourceId: schedule.id,
      metadata: { workflowId: dto.workflowId, cronExpr: dto.cronExpr },
    });
    return schedule;
  }

  @Get()
  @ApiOperation({ summary: 'List schedules' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(@Param('podId') podId: string) {
    return this.service.findAll(podId);
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update a schedule (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(podId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Delete a schedule (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    await this.service.delete(podId, id);
    void this.auditService.log({
      workspaceId,
      actorId: user.id,
      action: 'schedule.delete',
      resourceType: 'schedule',
      resourceId: id,
    });
  }
}
