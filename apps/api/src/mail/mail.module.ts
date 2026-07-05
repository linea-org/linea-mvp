import { Module } from '@nestjs/common';
import { MailService } from './mail.service.js';
import { ConfigModule } from '../config/config.module.js';

@Module({
  imports: [ConfigModule],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
