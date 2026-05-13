import { Controller, Get, Post, Param, HttpCode } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { WorkspacesService } from './workspaces.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Invites')
@ApiBearerAuth()
@Controller('invites')
export class InvitesController {
  constructor(private readonly service: WorkspacesService) {}

  @Get(':token')
  @ApiOperation({ summary: 'Preview invite details by token' })
  @ApiParam({ name: 'token' })
  preview(@Param('token') token: string) {
    return this.service.getInviteDetails(token);
  }

  @Post(':token/accept')
  @HttpCode(200)
  @ApiOperation({ summary: 'Accept a workspace invite' })
  @ApiParam({ name: 'token', description: 'Invite token from the invite URL' })
  accept(@Param('token') token: string, @CurrentUser() user: User) {
    return this.service.acceptInvite(token, user.id);
  }
}
