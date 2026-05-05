import { Module } from '@nestjs/common';
import { WorkspacesService } from './workspaces.service';
import { WorkspacesController } from './workspaces.controller';
import { InvitesController } from './invites.controller';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@Module({
  providers: [WorkspacesService, WorkspaceGuard],
  controllers: [WorkspacesController, InvitesController],
  exports: [WorkspacesService, WorkspaceGuard],
})
export class WorkspacesModule {}
