'use strict';
import {
  Controller,
  Get,
  Patch,
  Delete,
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
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import type { User } from '@linea/db';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: "List current user's notifications for this workspace",
  })
  @ApiParam({ name: 'workspaceId' })
  findAll(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.service.findAll(user.id, workspaceId);
  }

  @Patch('read-all')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiParam({ name: 'workspaceId' })
  markAllRead(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.service.markAllRead(user.id, workspaceId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  markRead(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.markRead(user.id, workspaceId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'id' })
  delete(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(user.id, workspaceId, id);
  }
}
