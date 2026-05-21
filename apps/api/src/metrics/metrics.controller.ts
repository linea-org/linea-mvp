import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { MetricsService } from './metrics.service';
import { GetMetricsDto } from './dto/get-metrics.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';

@ApiTags('Metrics')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/metrics')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  @Get()
  @ApiOperation({ summary: 'Get workspace execution metrics' })
  @ApiParam({ name: 'workspaceId' })
  getMetrics(
    @Param('workspaceId') workspaceId: string,
    @Query() query: GetMetricsDto,
  ) {
    return this.service.getWorkspaceMetrics(workspaceId, query.period);
  }
}
