import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SchedulesService } from './schedules.service';

@Injectable()
export class SchedulerService {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    await this.schedulesService.fireDueSchedules();
  }
}
