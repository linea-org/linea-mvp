'use strict';
import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  HttpCode,
  UseGuards,
  Sse,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { map, takeUntil, timer } from 'rxjs';
import { NotificationsService } from './notifications.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
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

  /** SSE stream — emits a `ping` event every 25 s and a `notification` event
   *  whenever a new notification is created for this user+workspace. */
  @Sse('stream')
  @ApiOperation({ summary: 'Server-sent events stream for new notifications' })
  @ApiParam({ name: 'workspaceId' })
  stream(@CurrentUser() user: User, @Param('workspaceId') workspaceId: string) {
    const subject = this.service.getStream(user.id, workspaceId);
    return subject.pipe(
      map(() => ({ data: { type: 'notification' } })),
      // Close after 10 minutes — client should reconnect
      takeUntil(timer(10 * 60 * 1000)),
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get the unread notification count' })
  @ApiParam({ name: 'workspaceId' })
  async unreadCount(
    @CurrentUser() user: User,
    @Param('workspaceId') workspaceId: string,
  ) {
    const count = await this.service.countUnread(user.id, workspaceId);
    return { count };
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
