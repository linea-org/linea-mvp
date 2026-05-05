import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, lte } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { schedules, spaces, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';
import type { CreateScheduleDto } from './dto/create-schedule.dto';
import type { UpdateScheduleDto } from './dto/update-schedule.dto';
import { CronExpressionParser } from 'cron-parser';

@Injectable()
export class SchedulesService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
  ) {}

  private nextRunDate(cronExpr: string): Date {
    return CronExpressionParser.parse(cronExpr).next().toDate();
  }

  async create(spaceId: string, dto: CreateScheduleDto) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, dto.workflowId), eq(workflows.spaceId, spaceId)))
      .limit(1);

    if (!wf) throw new NotFoundException(`Workflow ${dto.workflowId} not found`);

    const nextRunAt = this.nextRunDate(dto.cronExpr);

    const [record] = await this.db
      .insert(schedules)
      .values({
        spaceId,
        workflowId: dto.workflowId,
        cronExpr: dto.cronExpr,
        input: dto.input ?? {},
        enabled: dto.enabled ?? true,
        nextRunAt,
      })
      .returning();

    return record;
  }

  async findAll(spaceId: string) {
    return this.db.select().from(schedules).where(eq(schedules.spaceId, spaceId));
  }

  async update(spaceId: string, id: string, dto: UpdateScheduleDto) {
    const [existing] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.spaceId, spaceId)))
      .limit(1);

    if (!existing) throw new NotFoundException(`Schedule ${id} not found`);

    const cronExpr = dto.cronExpr ?? existing.cronExpr;
    const nextRunAt = dto.cronExpr ? this.nextRunDate(cronExpr) : existing.nextRunAt;

    const [updated] = await this.db
      .update(schedules)
      .set({
        ...(dto.cronExpr !== undefined && { cronExpr }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.input !== undefined && { input: dto.input }),
        nextRunAt,
      })
      .where(eq(schedules.id, id))
      .returning();

    return updated;
  }

  async delete(spaceId: string, id: string) {
    const [row] = await this.db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.spaceId, spaceId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Schedule ${id} not found`);

    await this.db.delete(schedules).where(eq(schedules.id, id));
  }

  async fireDueSchedules() {
    const now = new Date();

    const due = await this.db
      .select({
        id: schedules.id,
        spaceId: schedules.spaceId,
        workspaceId: spaces.workspaceId,
        workflowId: schedules.workflowId,
        cronExpr: schedules.cronExpr,
        input: schedules.input,
      })
      .from(schedules)
      .innerJoin(spaces, eq(spaces.id, schedules.spaceId))
      .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)));

    for (const schedule of due) {
      try {
        await this.executionsService.createFromTrigger(
          schedule.spaceId,
          schedule.workspaceId,
          schedule.workflowId,
          'schedule',
          schedule.input,
        );
      } catch {
        // Don't let one failing schedule block the rest
      }

      const nextRunAt = this.nextRunDate(schedule.cronExpr);
      await this.db
        .update(schedules)
        .set({ lastRunAt: now, nextRunAt })
        .where(eq(schedules.id, schedule.id));
    }
  }
}
