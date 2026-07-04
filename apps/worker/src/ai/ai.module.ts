import { AIClient } from '@linea/ai';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '../database/database.module';
import { Database } from '@linea/db';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: AIClient,
      useFactory: (config: ConfigService, db: Database) => {
        return new AIClient(
          {
            openaiApiKey: config.get<string>('OPENAI_API_KEY'),
            anthropicApiKey: config.get<string>('ANTHROPIC_API_KEY'),
            googleApiKey: config.get<string>('GOOGLE_API_KEY'),
            groqApiKey: config.get<string>('GROQ_API_KEY'),
            xaiApiKey: config.get<string>('XAI_API_KEY'),
            encryption: {
              keys: {
                1: config.get<string>('ENCRYPTION_KEY_1'),
              },
            },
          },
          db,
        );
      },
      inject: [ConfigService, Database],
    },
  ],
  exports: [AIClient],
})
export class AIModule {}
