import { Module } from '@nestjs/common';
import { AgentChatService } from './agent-chat.service';
import { AgentChatController } from './agent-chat.controller';
import { SecretsModule } from '../secrets/secrets.module';
import { ExecutionsModule } from '../executions/executions.module';
import { McpModule } from '../mcp/mcp.module';
import { AIModule } from '../services/ai/ai.module';

@Module({
  imports: [SecretsModule, ExecutionsModule, McpModule, AIModule],
  providers: [AgentChatService],
  controllers: [AgentChatController],
})
export class AgentChatModule {}
