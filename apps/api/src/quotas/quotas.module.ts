import { Module } from '@nestjs/common';
import { QuotasService } from './quotas.service.js';
import { DatabaseModule } from '../database/database.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
