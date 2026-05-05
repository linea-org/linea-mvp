import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';
import {
  WebhooksController,
  WebhookTriggerController,
} from './webhooks.controller';
import { ExecutionsModule } from '../executions/executions.module';

@Module({
  imports: [ExecutionsModule],
  providers: [WebhooksService],
  controllers: [WebhooksController, WebhookTriggerController],
})
export class WebhooksModule {}
