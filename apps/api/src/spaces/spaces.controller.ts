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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { SpacesService } from './spaces.service';
import { CreateSpaceDto } from './dto/create-space.dto';
import { UpdateSpaceDto } from './dto/update-space.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceMembership } from '../common/decorators/workspace-membership.decorator';
import type { User, WorkspaceMember } from '@linea/db';

@ApiTags('Spaces')
@ApiBearerAuth()
@UseGuards(WorkspaceGuard)
@Controller('workspaces/:workspaceId/spaces')
export class SpacesController {
  constructor(private readonly service: SpacesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a space (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  create(
    @Param('workspaceId') workspaceId: string,
    @CurrentUser() user: User,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: CreateSpaceDto,
  ) {
    return this.service.create(workspaceId, user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List spaces in a workspace' })
  @ApiParam({ name: 'workspaceId' })
  findAll(@Param('workspaceId') workspaceId: string) {
    return this.service.findAll(workspaceId);
  }

  @Get(':spaceId')
  @ApiOperation({ summary: 'Get a space' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  findOne(@Param('workspaceId') workspaceId: string, @Param('spaceId') spaceId: string) {
    return this.service.findOne(workspaceId, spaceId);
  }

  @Patch(':spaceId')
  @ApiOperation({ summary: 'Update a space (editor+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  update(
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: UpdateSpaceDto,
  ) {
    return this.service.update(workspaceId, spaceId, membership, dto);
  }

  @Delete(':spaceId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a space (admin+)' })
  @ApiParam({ name: 'workspaceId' })
  @ApiParam({ name: 'spaceId' })
  delete(
    @Param('workspaceId') workspaceId: string,
    @Param('spaceId') spaceId: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.delete(workspaceId, spaceId, membership);
  }
}
