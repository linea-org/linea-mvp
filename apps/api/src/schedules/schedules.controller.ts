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
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { SpaceGuard } from '../common/guards/space.guard';

@ApiTags('Schedules')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, SpaceGuard)
@Controller('workspaces/:workspaceId/spaces/:spaceId/schedules')
export class SchedulesController {
  constructor(private readonly service: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a cron schedule' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  create(
    @Param('spaceId') spaceId: string,
    @Body() dto: CreateScheduleDto,
  ) {
    return this.service.create(spaceId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List schedules' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  findAll(@Param('spaceId') spaceId: string) {
    return this.service.findAll(spaceId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a schedule' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('spaceId') spaceId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    return this.service.update(spaceId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a schedule' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  @ApiParam({ name: 'id' })
  delete(@Param('spaceId') spaceId: string, @Param('id') id: string) {
    return this.service.delete(spaceId, id);
  }
}
