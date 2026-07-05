import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service.js';
import { WorkflowController } from './workflow.controller.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { GlobalAdminGuard } from '../common/guards/global-admin.guard.js';

@Module({
  controllers: [WorkflowController],
  providers: [GlobalAdminGuard, WorkspaceGuard, WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
