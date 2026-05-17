import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam } from '@nestjs/swagger';
import { NodeExecutorService } from './engine/node-executor.service';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { ClerkAuthGuard } from '../auth/guards/clerk-auth.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';

class TestNodeDto {
  nodeType!: string;
  nodeData!: Record<string, unknown>;
  input!: Record<string, unknown>;
}

@ApiTags('Nodes')
@ApiBearerAuth()
@UseGuards(ClerkAuthGuard, WorkspaceGuard, PodGuard, RoleGuard)
@Controller('workspaces/:workspaceId/pods/:podId/nodes')
export class NodesController {
  constructor(private readonly nodeExecutor: NodeExecutorService) {}

  @Post('test')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Test a single node in isolation' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  async testNode(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: TestNodeDto,
  ) {
    const state = {
      variables: { input: dto.input, lastOutput: dto.input, ...dto.input },
      chatHistory: [] as Array<{ role: string; content: string }>,
      memory: {} as Record<string, unknown>,
      currentNodeId: 'test',
      nodeResults: {} as Record<string, unknown>,
      pendingAuth: null,
      loopResults: [] as unknown[],
      cumulativeUsage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };

    const startedAt = Date.now();
    try {
      const { result } = await this.nodeExecutor.execute({
        nodeId: 'test-node',
        nodeType: dto.nodeType,
        nodeData: dto.nodeData,
        state,
        workspaceId,
      });
      return { output: result, durationMs: Date.now() - startedAt };
    } catch (err) {
      return {
        output: null,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startedAt,
      };
    }
  }
}
