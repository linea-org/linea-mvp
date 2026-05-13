import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PostgresSaver } from '@langchain/langgraph-checkpoint-postgres';

@Injectable()
export class CheckpointerService implements OnModuleInit {
  private readonly logger = new Logger(CheckpointerService.name);
  checkpointer!: PostgresSaver;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const connString = this.config.getOrThrow<string>('DATABASE_URL');
    this.checkpointer = PostgresSaver.fromConnString(connString);
    await this.checkpointer.setup();
    this.logger.log('PostgreSQL checkpoint tables ready');
  }
}
