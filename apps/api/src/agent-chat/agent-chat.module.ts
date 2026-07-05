import { Module } from '@nestjs/common';
import { AgentChatService } from './agent-chat.service.js';
import { AgentChatController } from './agent-chat.controller.js';
import { SecretsModule } from '../secrets/secrets.module.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { McpModule } from '../mcp/mcp.module.js';
import { AIModule } from '../services/ai/ai.module.js';

@Module({
  imports: [SecretsModule, ExecutionsModule, McpModule, AIModule],
  providers: [AgentChatService],
  controllers: [AgentChatController],
})
export class AgentChatModule {}
