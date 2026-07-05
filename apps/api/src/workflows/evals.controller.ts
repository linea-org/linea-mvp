import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { EvalsService, type TestCase } from './evals.service.js';
import { WorkspaceGuard } from '../common/guards/workspace.guard.js';
import { PodGuard } from '../common/guards/pod.guard.js';
import { RoleGuard } from '../common/guards/role.guard.js';
import { RequireRole } from '../common/decorators/require-role.decorator.js';

class RunEvalsDto {
  testCases!: TestCase[];
}

@ApiTags('Evals')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/workflows/:workflowId/evals')
export class EvalsController {
  constructor(private readonly service: EvalsService) {}

  @Post('run')
  @HttpCode(200)
  @RequireRole('editor')
  @ApiOperation({ summary: 'Run eval cases for a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  run(
    @Param('podId') podId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body() dto: RunEvalsDto,
  ) {
    return this.service.runTestCases(
      podId,
      workspaceId,
      workflowId,
      dto.testCases,
    );
  }

  @Get('runs')
  @RequireRole('viewer')
  @ApiOperation({ summary: 'Get eval run history for a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  @ApiQuery({ name: 'limit', required: false })
  getHistory(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getRunHistory(
      workflowId,
      podId,
      limit ? parseInt(limit, 10) : 20,
    );
  }
}
