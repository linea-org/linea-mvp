import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { GenerateWorkflowService } from './generate-workflow.service';
import {
  WorkflowsController,
  TemplatesController,
} from './workflows.controller';
import { TemplatesSeeder } from './templates.seeder';
import { GlobalAdminGuard } from '../common/guards/global-admin.guard';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PodsModule } from '../pods/pods.module';

@Module({
  imports: [WorkspacesModule, PodsModule],
  providers: [WorkflowsService, GenerateWorkflowService, TemplatesSeeder, GlobalAdminGuard],
  controllers: [WorkflowsController, TemplatesController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
