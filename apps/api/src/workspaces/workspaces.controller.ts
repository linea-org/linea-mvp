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
import { WorkspacesService } from './workspaces.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { WorkspaceGuard } from '../common/guards/workspace.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WorkspaceMembership } from '../common/decorators/workspace-membership.decorator';
import type { User, WorkspaceMember } from '@linea/db';

@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly service: WorkspacesService) {}

  // ─── Workspace CRUD ────────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create a workspace' })
  create(@CurrentUser() user: User, @Body() dto: CreateWorkspaceDto) {
    return this.service.create(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the current user's workspaces" })
  listMine(@CurrentUser() user: User) {
    return this.service.findAllForUser(user.id);
  }

  @Get(':id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Get a workspace' })
  @ApiParam({ name: 'id', description: 'Workspace ID' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Update workspace name or slug (admin+)' })
  update(
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.service.update(id, membership, dto);
  }

  @Delete(':id')
  @UseGuards(WorkspaceGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a workspace (owner only)' })
  delete(
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.delete(id, membership);
  }

  // ─── Members ───────────────────────────────────────────────────────────────

  @Get(':id/members')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List workspace members' })
  getMembers(@Param('id') id: string) {
    return this.service.getMembers(id);
  }

  @Patch(':id/members/:userId')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Change a member role (admin+)' })
  updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.service.updateMemberRole(id, userId, membership, dto);
  }

  @Delete(':id/members/:userId')
  @UseGuards(WorkspaceGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member (admin+)' })
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.removeMember(id, userId, membership);
  }

  // ─── Invites ───────────────────────────────────────────────────────────────

  @Post(':id/invites')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'Create an invite (admin+)' })
  createInvite(
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
    @Body() dto: InviteMemberDto,
  ) {
    return this.service.createInvite(id, membership, dto);
  }

  @Get(':id/invites')
  @UseGuards(WorkspaceGuard)
  @ApiOperation({ summary: 'List pending invites (admin+)' })
  listInvites(
    @Param('id') id: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.listInvites(id, membership);
  }

  @Delete(':id/invites/:inviteId')
  @UseGuards(WorkspaceGuard)
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke an invite (admin+)' })
  revokeInvite(
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
    @WorkspaceMembership() membership: WorkspaceMember,
  ) {
    return this.service.revokeInvite(id, inviteId, membership);
  }
}
