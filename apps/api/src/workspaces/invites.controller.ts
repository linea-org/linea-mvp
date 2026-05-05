import { Controller, Post, Param } from '@nestjs/common';
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

  @Post(':token/accept')
  @ApiOperation({ summary: 'Accept a workspace invite' })
  @ApiParam({ name: 'token', description: 'Invite token from the invite URL' })
  accept(@Param('token') token: string, @CurrentUser() user: User) {
    return this.service.acceptInvite(token, user.id);
  }
}
