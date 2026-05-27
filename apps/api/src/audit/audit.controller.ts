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
  findAll(
    @Param('workspaceId') workspaceId: string,
    @Query('period') period?: string,
    @Query('resourceType') resourceType?: string,
  ) {
    return this.service.findAll(workspaceId, period, resourceType);
  }
}
