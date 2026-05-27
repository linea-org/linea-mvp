import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Headers,
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
import { Observable, map, takeUntil, timer, from, concat, of, filter } from 'rxjs';
import { ExecutionsService } from './executions.service';
import { ExecutionEventsService } from './execution-events.service';
import type { BusEntry } from './execution-events.service';
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
  findAll(@Param('podId') podId: string, @Query() query: ListExecutionsDto) {
    return this.service.findAll(podId, query);
  }

  @Get(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Get an execution (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('podId') podId: string, @Param('id') id: string) {
    return this.service.findOne(podId, id);
  }

  @Get(':id/logs')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Get execution logs (editor+)' })
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
  async stream(
    @Param('podId') podId: string,
    @Param('id') id: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Promise<Observable<MessageEvent>> {
    const execution = await this.service.findOne(podId, id);

    const toMsg = (entry: BusEntry): MessageEvent =>
      ({ data: entry.event, id: entry.streamId }) as MessageEvent;

    // Terminal states: emit final event immediately (fast-path for reconnects too)
    if (execution.status === 'completed') {
      const event = {
        type: 'execution_complete',
        output: (execution.output as any)?.result ?? execution.output,
      };
      return of({ data: event } as MessageEvent);
    }
    if (execution.status === 'failed') {
      return of({ data: { type: 'execution_failed', error: execution.error } } as MessageEvent);
    }

    // Subscribe to live events BEFORE fetching replay so no events are missed
    // during the async Redis read. Events that fire in this window are buffered
    // locally and deduped against the replay results.
    const liveBuffer: BusEntry[] = [];
    const bufferSub = this.events.forExecution(id).subscribe((e) => liveBuffer.push(e));

    const replayItems = lastEventId ? await this.events.replayFrom(id, lastEventId) : [];
    bufferSub.unsubscribe();

    const replayedIds = new Set(replayItems.map((r) => r.streamId));
    const uniqueBuffer = liveBuffer.filter((e) => !replayedIds.has(e.streamId));

    const status$ = of({
      data: { type: 'execution_status', status: execution.status },
    } as MessageEvent);

    const live$ = this.events.forExecution(id).pipe(
      filter((e) => !replayedIds.has(e.streamId)),
      map(toMsg),
      takeUntil(timer(10 * 60 * 1000)),
    );

    return concat(
      from(replayItems.map(toMsg)),
      from(uniqueBuffer.map(toMsg)),
      status$,
      live$,
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
  @ApiOperation({
    summary: 'Replay an execution, optionally from a specific node (editor+)',
  })
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
