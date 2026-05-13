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
  Sse,
  MessageEvent,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Observable, map, takeUntil, timer } from 'rxjs';
import { ExecutionsService } from './executions.service';
import { ExecutionEventsService } from './execution-events.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { ListExecutionsDto } from './dto/list-executions.dto';
import { ApproveExecutionDto } from './dto/approve-execution.dto';
import { ReplayExecutionDto } from './dto/replay-execution.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Executions')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/executions')
export class ExecutionsController {
  constructor(
    private readonly service: ExecutionsService,
    private readonly events: ExecutionEventsService,
  ) {}

  @Post()
  @RequireRole('editor')
  @Throttle({ execution: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Trigger a workflow execution (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('podId') podId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateExecutionDto,
  ) {
    return this.service.create(podId, workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List executions' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  findAll(
    @Param('podId') podId: string,
    @Query() query: ListExecutionsDto,
  ) {
    return this.service.findAll(podId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.findOne(podId, id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  getLogs(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.getLogs(podId, id);
  }

  @Sse(':id/events')
  @SkipThrottle()
  @ApiOperation({ summary: 'Stream execution events via SSE' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  async stream(@Param('podId') podId: string, @Param('id') id: string): Promise<Observable<MessageEvent>> {
    // Verify the execution belongs to this pod before subscribing — prevents IDOR
    await this.service.findOne(podId, id);
    return this.events.forExecution(id).pipe(
      map((event) => ({ data: event }) as MessageEvent),
      takeUntil(timer(10 * 60 * 1000)),
    );
  }

  @Patch(':id/respond')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Respond to a suspended execution (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  respond(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExecutionDto,
  ) {
    return this.service.respond(podId, id, dto);
  }

  @Patch(':id/approve')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Approve a suspended execution (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  approve(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExecutionDto,
  ) {
    return this.service.respond(podId, id, dto);
  }

  @Post(':id/replay')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Replay an execution, optionally from a specific node (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  replay(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Body() dto: ReplayExecutionDto,
  ) {
    return this.service.replay(podId, id, dto.fromNodeId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Cancel an execution (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  cancel(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.cancel(podId, id);
  }
}
