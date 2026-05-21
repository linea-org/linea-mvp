import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulesService } from './schedules.service';
import { SchedulesController } from './schedules.controller';
import { SchedulerService } from './scheduler.service';
import { ExecutionsModule } from '../executions/executions.module';
import { PodsModule } from '../pods/pods.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [ScheduleModule.forRoot(), ExecutionsModule, PodsModule, AuditModule],
  providers: [SchedulesService, SchedulerService],
  controllers: [SchedulesController],
  exports: [SchedulesService],
})
export class SchedulesModule {}
