import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { McpController } from './mcp.controller';
import { WorkspacesModule } from '../workspaces/workspaces.module';

@Module({
  imports: [WorkspacesModule],
  providers: [McpService],
  controllers: [McpController],
  exports: [McpService],
})
export class McpModule {}
