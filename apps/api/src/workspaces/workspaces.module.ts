import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { InvitesController } from './invites.controller';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';

@Module({
  providers: [WorkspacesService, WorkspaceGuard, RoleGuard],
  controllers: [WorkspacesController, InvitesController],
  exports: [WorkspacesService, WorkspaceGuard, RoleGuard],
})
export class WorkspacesModule {}
