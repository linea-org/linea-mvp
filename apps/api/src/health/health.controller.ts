import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import type { DrizzleDB } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';
import { Public } from '../common/decorators/public.decorator.js';

@ApiTags('Health')
@Public()
@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {}

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([() => this.dbCheck()]);
  }

  private async dbCheck(): Promise<HealthIndicatorResult> {
    try {
      await this.db.execute(sql`SELECT 1`);
      return { database: { status: 'up' } };
    } catch {
      return { database: { status: 'down' } };
    }
  }
}
