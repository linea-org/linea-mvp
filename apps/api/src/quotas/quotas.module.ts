import { Module } from '@nestjs/common';
import { QuotasService } from './quotas.service';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [DatabaseModule, NotificationsModule],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
