import { Module } from '@nestjs/common';
import { BillingService } from './billing.service.js';
import { BillingController } from './billing.controller.js';
import { WorkspacesModule } from '../workspaces/workspaces.module.js';

@Module({
  imports: [WorkspacesModule],
  providers: [BillingService],
  controllers: [BillingController],
})
export class BillingModule {}
