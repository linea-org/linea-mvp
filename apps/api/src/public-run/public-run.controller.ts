import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiHeader } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { PublicRunService } from './public-run.service';
import { Public } from '../common/decorators/public.decorator';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

@ApiTags('Public Run')
@Controller('run')
export class PublicRunController {
  constructor(private readonly service: PublicRunService) {}

  @Get(':workflowId')
  @Public()
  @ApiOperation({ summary: 'Get schema for a publicly accessible workflow' })
  @ApiParam({ name: 'workflowId' })
  getSchema(@Param('workflowId') workflowId: string) {
    return this.service.getSchema(workflowId);
  }

  @Post(':workflowId')
  @Public()
  @ApiOperation({
    summary: 'Trigger a workflow execution via public REST endpoint',
  })
  @ApiParam({ name: 'workflowId' })
  @ApiHeader({
    name: 'x-api-key',
    required: false,
    description: 'API key for api_key-visibility workflows',
  })
  trigger(
    @Param('workflowId') workflowId: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-api-key') xApiKey?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const apiKey =
      xApiKey ??
      (authorization?.startsWith('Bearer ')
        ? authorization.slice(7)
        : undefined);
    return this.service.trigger(workflowId, body, apiKey);
  }

  @Get(':workflowId/executions/:executionId')
  @Public()
  @ApiOperation({ summary: 'Poll execution status (same API key as trigger)' })
  @ApiParam({ name: 'workflowId' })
  @ApiParam({ name: 'executionId' })
  @ApiHeader({ name: 'x-api-key', required: false })
  getExecutionStatus(
    @Param('workflowId') workflowId: string,
    @Param('executionId') executionId: string,
    @Headers('x-api-key') xApiKey?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const apiKey =
      xApiKey ??
      (authorization?.startsWith('Bearer ')
        ? authorization.slice(7)
        : undefined);
    return this.service.getExecutionStatus(workflowId, executionId, apiKey);
  }
}

@ApiTags('Workflow API Config')
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/workflows/:workflowId/api')
export class WorkflowApiController {
  constructor(private readonly service: PublicRunService) {}

  @Get()
  @ApiOperation({ summary: 'Get REST API config for a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  getConfig(
    @Param('workflowId') workflowId: string,
    @Param('podId') podId: string,
  ) {
    return this.service.getApiConfig(workflowId, podId);
  }

  @Patch()
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update REST API config for a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  setConfig(
    @Param('workflowId') workflowId: string,
    @Param('podId') podId: string,
    @Body()
    body: { apiEnabled?: boolean; apiVisibility?: 'api_key' | 'public' },
  ) {
    return this.service.setApiConfig(workflowId, podId, body);
  }

  @Post('rotate-key')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Rotate the API key for a workflow (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  async rotateKey(
    @Param('workflowId') workflowId: string,
    @Param('podId') podId: string,
  ) {
    const key = await this.service.rotateApiKey(workflowId, podId);
    return { apiKey: key };
  }
}
