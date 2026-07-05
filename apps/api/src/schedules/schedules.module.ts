import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulesService } from './schedules.service.js';
import { SchedulesController } from './schedules.controller.js';
import { SchedulerService } from './scheduler.service.js';
import { ExecutionsModule } from '../executions/executions.module.js';
import { PodsModule } from '../pods/pods.module.js';
import { AuditModule } from '../audit/audit.module.js';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ExecutionsModule,
    PodsModule,
    AuditModule,
  ],
  providers: [SchedulesService, SchedulerService],
  controllers: [SchedulesController],
  exports: [SchedulesService],
})
export class SchedulesModule {}
