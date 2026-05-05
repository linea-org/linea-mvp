import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: "List current user's notifications" })
  findAll(@CurrentUser() user: User) {
    return this.service.findAll(user.id);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  markAllRead(@CurrentUser() user: User) {
    return this.service.markAllRead(user.id);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  @ApiParam({ name: 'id' })
  markRead(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.markRead(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a notification' })
  @ApiParam({ name: 'id' })
  delete(@CurrentUser() user: User, @Param('id') id: string) {
    return this.service.delete(user.id, id);
  }
}
