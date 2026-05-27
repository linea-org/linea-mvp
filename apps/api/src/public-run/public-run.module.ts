import { Module } from '@nestjs/common';
import { PublicRunService } from './public-run.service';
import {
  PublicRunController,
  WorkflowApiController,
} from './public-run.controller';
import { ExecutionsModule } from '../executions/executions.module';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { PodsModule } from '../pods/pods.module';

@Module({
  imports: [ExecutionsModule, WorkspacesModule, PodsModule],
  providers: [PublicRunService],
  controllers: [PublicRunController, WorkflowApiController],
})
export class PublicRunModule {}
