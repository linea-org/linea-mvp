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
import { Observable, map, takeUntil, timer } from 'rxjs';
import { ExecutionsService } from './executions.service';
import { ExecutionEventsService } from './execution-events.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { ListExecutionsDto } from './dto/list-executions.dto';
import { ApproveExecutionDto } from './dto/approve-execution.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { SpaceGuard } from '../common/guards/space.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Executions')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, SpaceGuard)
@Controller('workspaces/:workspaceId/spaces/:spaceId/executions')
export class ExecutionsController {
  constructor(
    private readonly service: ExecutionsService,
    private readonly events: ExecutionEventsService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Trigger a workflow execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateExecutionDto,
  ) {
    return this.service.create(spaceId, workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List executions' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  findAll(
    @Param('spaceId') spaceId: string,
    @Query() query: ListExecutionsDto,
  ) {
    return this.service.findAll(spaceId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  findOne(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.findOne(spaceId, id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Get execution logs' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  getLogs(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.getLogs(spaceId, id);
  }

  @Sse(':id/events')
  @ApiOperation({ summary: 'Stream execution events via SSE' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  stream(@Param('id') id: string): Observable<MessageEvent> {
    return this.events.forExecution(id).pipe(
      map((event) => ({ data: event }) as MessageEvent),
      takeUntil(timer(10 * 60 * 1000)),
    );
  }

  @Patch(':id/respond')
  @ApiOperation({ summary: 'Respond to a suspended execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  respond(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExecutionDto,
  ) {
    return this.service.respond(spaceId, id, dto);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: 'Approve a suspended execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  approve(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body() dto: ApproveExecutionDto,
  ) {
    return this.service.respond(spaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Cancel an execution' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  cancel(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.cancel(spaceId, id);
  }
}
