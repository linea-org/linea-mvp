import { Module } from '@nestjs/common';
import { QuotasService } from './quotas.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
