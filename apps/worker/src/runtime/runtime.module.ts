import { Module } from '@nestjs/common';
import { AIClient } from '@linea/ai';

import { AIModule } from '../ai/ai.module.js';
import { Runtime } from '@linea/runtime';

@Module({
  imports: [AIModule],
  providers: [
    {
      provide: Runtime,
      useFactory: (ai: AIClient) => new Runtime(ai),
      inject: [AIClient],
    },
  ],
  exports: [Runtime],
})
export class RuntimeModule {}
