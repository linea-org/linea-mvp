import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { GenerateWorkflowService } from './generate-workflow.service';
import {
  WorkflowsController,
  TemplatesController,
} from './workflows.controller';
import { TemplatesSeeder } from './templates.seeder';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PodsModule } from '../pods/pods.module';

@Module({
  imports: [WorkspacesModule, PodsModule],
  providers: [WorkflowsService, GenerateWorkflowService, TemplatesSeeder],
  controllers: [WorkflowsController, TemplatesController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
