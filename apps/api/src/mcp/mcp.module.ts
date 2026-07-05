import { Module } from '@nestjs/common';
import { McpService } from './mcp.service.js';
import { McpController } from './mcp.controller.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

@Module({
  imports: [WorkspacesModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService],
})
export class McpModule {}
