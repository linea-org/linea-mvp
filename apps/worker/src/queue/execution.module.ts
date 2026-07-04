import { AIClient } from '@linea/ai';
import { Database } from '@linea/db';
import { Injectable, OnModuleInit } from '@nestjs/common';

@Injectable()
export class ExecutionConsumer implements OnModuleInit {
  constructor(
    private readonly ai: AIClient,
    private readonly database: Database,
  ) {}

  async onModuleInit() {
    // Create BullMQ Worker here
  }
}
