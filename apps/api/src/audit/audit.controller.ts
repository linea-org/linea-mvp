import { Controller, Get, Query, UseGuards, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

function parsePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseDate(value: string | undefined, endOfDay = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, RoleGuard)
@Controller('workspaces/:workspaceId/audit-logs')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @RequireRole('admin')
  @ApiOperation({ summary: 'List audit log events for a workspace' })
  @ApiParam({ name: 'workspaceId' })
  @ApiQuery({ name: 'period', required: false, enum: ['24h', '7d', '30d'] })
  @ApiQuery({ name: 'resourceType', required: false })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 50 })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date or datetime' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date or datetime' })
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('period') period?: string,
    @Query('resourceType') resourceType?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (page || limit || action || from || to) {
      return this.service.findAllPaginated(workspaceId, {
        page: parsePositiveInt(page, 1),
        limit: parsePositiveInt(limit, 50),
        action: action || undefined,
        from: parseDate(from),
        to: parseDate(to, true),
      });
    }

    return this.service.findAll(workspaceId, period, resourceType);
  }
}
