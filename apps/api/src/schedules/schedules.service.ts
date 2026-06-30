import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, lte, count, sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { schedules, pods, workflows } from '@linea/db';
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

  async create(podId: string, dto: CreateScheduleDto) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, dto.workflowId), eq(workflows.podId, podId)))
      .limit(1);

    if (!wf)
      throw new NotFoundException(`Workflow ${dto.workflowId} not found`);

    const MAX_SCHEDULES_PER_POD = 100;
    const [{ value: scheduleCount }] = await this.db
      .select({ value: count() })
      .from(schedules)
      .where(eq(schedules.podId, podId));
    if (scheduleCount >= MAX_SCHEDULES_PER_POD) {
      throw new BadRequestException(
        `Pod has reached the maximum of ${MAX_SCHEDULES_PER_POD} schedules`,
      );
    }

    const nextRunAt = this.nextRunDate(dto.cronExpr);

    const [record] = await this.db
      .insert(schedules)
      .values({
        podId,
        workflowId: dto.workflowId,
        cronExpr: dto.cronExpr,
        input: dto.input ?? {},
        enabled: dto.enabled ?? true,
        nextRunAt,
      })
      .returning();

    return record;
  }

  async findAll(podId: string) {
    return this.db.select().from(schedules).where(eq(schedules.podId, podId));
  }

  async findOne(podId: string, id: string) {
    const [record] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.podId, podId)))
      .limit(1);

    if (!record) throw new NotFoundException(`Schedule ${id} not found`);

    return record;
  }

  async update(podId: string, id: string, dto: UpdateScheduleDto) {
    const [existing] = await this.db
      .select()
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.podId, podId)))
      .limit(1);

    if (!existing) throw new NotFoundException(`Schedule ${id} not found`);

    const cronExpr = dto.cronExpr ?? existing.cronExpr;
    const nextRunAt = dto.cronExpr
      ? this.nextRunDate(cronExpr)
      : existing.nextRunAt;

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

  async delete(podId: string, id: string) {
    const [row] = await this.db
      .select({ id: schedules.id })
      .from(schedules)
      .where(and(eq(schedules.id, id), eq(schedules.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Schedule ${id} not found`);

    await this.db.delete(schedules).where(eq(schedules.id, id));
  }

  async syncWorkflowSchedule(
    podId: string,
    workflowId: string,
    definition: unknown,
  ): Promise<void> {
    const nodes: any[] = (definition as any)?.nodes ?? [];
    const startNode = nodes.find((n: any) => n.type === 'start');
    const triggerType = startNode?.data?.triggerType as string | undefined;
    const cronExpr = startNode?.data?.cronExpression as string | undefined;

    if (triggerType === 'schedule' && cronExpr) {
      try {
        const fields = cronExpr.trim().split(/\s+/);
        if (fields.length !== 5) return;
        CronExpressionParser.parse(cronExpr);
      } catch {
        return; // invalid cron — skip silently
      }

      const nextRunAt = this.nextRunDate(cronExpr);
      await this.db
        .delete(schedules)
        .where(eq(schedules.workflowId, workflowId));
      await this.db.insert(schedules).values({
        podId,
        workflowId,
        cronExpr,
        input: {},
        enabled: true,
        nextRunAt,
      });
    } else {
      await this.db
        .delete(schedules)
        .where(eq(schedules.workflowId, workflowId));
    }
  }

  async fireDueSchedules() {
    const now = new Date();

    const due = await this.db
      .select({
        id: schedules.id,
        podId: schedules.podId,
        workspaceId: pods.workspaceId,
        workflowId: schedules.workflowId,
        cronExpr: schedules.cronExpr,
        input: schedules.input,
      })
      .from(schedules)
      .innerJoin(pods, eq(pods.id, schedules.podId))
      .where(and(eq(schedules.enabled, true), lte(schedules.nextRunAt, now)));

    for (const schedule of due) {
      const nextRunAt = this.nextRunDate(schedule.cronExpr);

      try {
        await this.executionsService.createFromTrigger(
          schedule.podId,
          schedule.workspaceId,
          schedule.workflowId,
          'schedule',
          schedule.input,
        );

        await this.db
          .update(schedules)
          .set({
            lastRunAt: now,
            nextRunAt,
            lastError: null,
            consecutiveFailures: 0,
          })
          .where(eq(schedules.id, schedule.id));
      } catch (err) {
        const lastError = err instanceof Error ? err.message : String(err);

        await this.db
          .update(schedules)
          .set({
            lastRunAt: now,
            nextRunAt,
            lastError,
            consecutiveFailures: sql`${schedules.consecutiveFailures} + 1`,
          })
          .where(eq(schedules.id, schedule.id));
      }
    }
  }
}
