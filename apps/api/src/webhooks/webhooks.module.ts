import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { WebhooksService, WEBHOOK_REDIS } from './webhooks.service';
import {
  WebhooksController,
  WebhookTriggerController,
} from './webhooks.controller';
import { ExecutionsModule } from '../executions/executions.module';
import { PodsModule } from '../pods/pods.module';

@Module({
  imports: [ExecutionsModule, PodsModule, ConfigModule],
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
