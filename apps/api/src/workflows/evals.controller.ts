import { Controller, Post, Body, Param, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { EvalsService, type TestCase } from './evals.service';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

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
  @ApiOperation({ summary: 'Run workflow test cases' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  run(
    @Param('podId') podId: string,
    @Param('workspaceId') workspaceId: string,
    @Param('workflowId') workflowId: string,
    @Body() dto: RunEvalsDto,
  ) {
    return this.service.runTestCases(podId, workspaceId, workflowId, dto.testCases);
  }
}
