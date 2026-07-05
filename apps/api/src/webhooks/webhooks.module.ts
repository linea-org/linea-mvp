import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { WebhooksService, WEBHOOK_REDIS } from './webhooks.service.js';
import {
  WebhooksController,
  WebhookTriggerController,
} from './webhooks.controller.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { PodsModule } from '../pods/pods.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [ExecutionsModule, PodsModule, ConfigModule, AuditModule],
  providers: [
    {
      provide: WEBHOOK_REDIS,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        return redisUrl
          ? new Redis(redisUrl)
          : new Redis({ host: 'localhost', port: 6379 });
      },
      inject: [ConfigService],
    },
    WebhooksService,
  ],
  controllers: [WebhooksController, WebhookTriggerController],
})
export class WebhooksModule {}
