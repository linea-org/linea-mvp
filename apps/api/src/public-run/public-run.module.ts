import { Module } from '@nestjs/common';
import { PublicRunService } from './public-run.service.js';
import {
  PublicRunController,
  WorkflowApiController,
} from './public-run.controller.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';
import { PodsModule } from '../pods/pods.module.js';
import { AIModule } from '../services/ai/ai.module.js';

@Module({
  imports: [ExecutionsModule, WorkspacesModule, PodsModule, AIModule],
  providers: [PublicRunService],
  controllers: [PublicRunController, WorkflowApiController],
})
export class PublicRunModule {}
