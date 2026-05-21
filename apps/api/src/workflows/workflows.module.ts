import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import { GenerateWorkflowService } from './generate-workflow.service';
import { EvalsService } from './evals.service';
import {
  WorkflowsController,
  TemplatesController,
} from './workflows.controller';
import { EvalsController } from './evals.controller';
import { TemplatesSeeder } from './templates.seeder';
import { GlobalAdminGuard } from '../common/guards/global-admin.guard';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PodsModule } from '../pods/pods.module';
import { UsersModule } from '../users/users.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ExecutionsModule } from '../executions/executions.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [WorkspacesModule, PodsModule, UsersModule, SchedulesModule, ExecutionsModule, AuditModule],
  providers: [WorkflowsService, GenerateWorkflowService, EvalsService, TemplatesSeeder, GlobalAdminGuard],
  controllers: [WorkflowsController, TemplatesController, EvalsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
