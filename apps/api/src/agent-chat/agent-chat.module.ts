import { Module } from '@nestjs/common';
import { AgentChatService } from './agent-chat.service';
import { AgentChatController } from './agent-chat.controller';
import { SecretsModule } from '../secrets/secrets.module';

@Module({
  imports: [SecretsModule],
  providers: [AgentChatService],
  controllers: [AgentChatController],
})
export class AgentChatModule {}
