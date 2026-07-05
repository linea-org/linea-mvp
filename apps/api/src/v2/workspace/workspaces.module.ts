import { Module } from '@nestjs/common';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { WorkspacesService } from './workspaces.service.js';
import { WorkspacesController } from './workspaces.controller.js';
import { InvitesController } from './invites.controller.js';
import { MailModule } from '../../mail/mail.module.js';

@Module({
  imports: [MailModule],
  providers: [WorkspacesService, WorkspaceGuard, RoleGuard],
  controllers: [WorkspacesController, InvitesController],
  exports: [WorkspacesService, WorkspaceGuard, RoleGuard],
})
export class WorkspacesModule {}
