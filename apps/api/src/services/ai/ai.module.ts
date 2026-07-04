import { Module } from '@nestjs/common';
import { ConnectionsModule } from 'src/connections/connections.module';
import { AIService } from 'src/services/ai/ai.service';

@Module({
  imports: [ConnectionsModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
