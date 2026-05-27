import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ReactCommentDto } from './dto/react-comment.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { PodGuard } from '../common/guards/pod.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RequireRole } from '../common/decorators/require-role.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '@linea/db';

@ApiTags('Comments')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard, PodGuard, RoleGuard)
@Controller(
  'workspaces/:workspaceId/pods/:podId/workflows/:workflowId/comments',
)
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'List all comments for a workflow' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  findAll(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
  ) {
    return this.service.findAll(workflowId, podId, user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a comment' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  create(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @CurrentUser() user: User,
    @Body() dto: CreateCommentDto,
  ) {
    return this.service.create(workflowId, podId, user.id, dto);
  }

  @Patch(':id')
  @RequireRole('editor')
  @ApiOperation({ summary: 'Update a comment (body or resolved status)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  @ApiParam({ name: 'id' })
  update(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.service.update(workflowId, podId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a comment' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  @ApiParam({ name: 'id' })
  remove(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    return this.service.remove(workflowId, podId, user.id, id);
  }

  @Post(':id/react')
  @ApiOperation({ summary: 'Toggle a reaction on a comment' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'podId' })
  @ApiParam({ name: 'workflowId' })
  @ApiParam({ name: 'id' })
  react(
    @Param('podId') podId: string,
    @Param('workflowId') workflowId: string,
    @Param('id') id: string,
    @CurrentUser() user: User,
    @Body() dto: ReactCommentDto,
  ) {
    return this.service.react(workflowId, podId, user.id, id, dto.emoji);
  }
}
