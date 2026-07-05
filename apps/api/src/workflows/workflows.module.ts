import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service.js';
import { GenerateWorkflowService } from './generate-workflow.service.js';
import { EvalsService } from './evals.service.js';
import {
  WorkflowsController,
  TemplatesController,
} from './workflows.controller.js';
import { EvalsController } from './evals.controller.js';
import { TemplatesSeeder } from './templates.seeder.js';
import { GlobalAdminGuard } from '../common/guards/global-admin.guard.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { PodsModule } from '../pods/pods.module.js';
import { UsersModule } from '../users/users.module.js';
import { SchedulesModule } from '../schedules/schedules.module.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    WorkspacesModule,
    PodsModule,
    UsersModule,
    SchedulesModule,
    ExecutionsModule,
    AuditModule,
  ],
  providers: [
    WorkflowsService,
    GenerateWorkflowService,
    EvalsService,
    TemplatesSeeder,
    GlobalAdminGuard,
  ],
  controllers: [WorkflowsController, TemplatesController, EvalsController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
