import { Module } from '@nestjs/common';
import { WorkflowsService } from './workflows.service';
import {
  WorkflowsController,
  TemplatesController,
} from './workflows.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule],
  providers: [WorkflowsService],
  controllers: [WorkflowsController, TemplatesController],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
