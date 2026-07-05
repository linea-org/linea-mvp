import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { and, eq, gt, sql } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { Database } from '@linea/db';
import type {
  WorkspaceSettings,
  WorkspaceMember,
} from '@linea/shared/contracts';
import {
  workspaces,
  workspaceMembers,
  workspaceInvites,
  users,
} from '@linea/db';
import type { CreateWorkspaceDto } from './dto/create-workspace.dto.js';
import type { UpdateWorkspaceDto } from './dto/update-workspace.dto.js';
import type { InviteMemberDto } from './dto/invite-member.dto.js';
import type { UpdateMemberRoleDto } from './dto/update-member-role.dto.js';
import { MailService } from '../../mail/mail.service.js';

const ROLE_LEVEL: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

function assertMinRole(
  membership: WorkspaceMember,
  minimum: 'owner' | 'admin' | 'editor',
) {
  const level = ROLE_LEVEL[membership.role] ?? 0; // unknown role → 0 (no access)
  const minLevel = ROLE_LEVEL[minimum] ?? Infinity; // unknown minimum → deny
  if (level < minLevel) {
    throw new ForbiddenException(
      `This action requires the '${minimum}' role or higher`,
    );
  }
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly db: Database,
    private readonly mail: MailService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto) {
    const slug = dto.slug ?? this.generateSlug(dto.name);

    const existing = await this.db.client
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.slug, slug))
      .limit(1);

    if (existing.length)
      throw new ConflictException(`Slug '${slug}' is already taken`);

    const [workspace] = await this.db.client
      .insert(workspaces)
      .values({ name: dto.name, slug })
      .returning();

    await this.db.client.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: 'owner',
    });

    return workspace;
  }

  async findAllForUser(userId: string) {
    const rows = await this.db.client
      .select({ workspace: workspaces, role: workspaceMembers.role })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(eq(workspaceMembers.userId, userId));
    return rows.map(({ workspace, role }) => ({ ...workspace, role }));
  }

  async findOne(id: string) {
    const [ws] = await this.db.client
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .limit(1);

    if (!ws) throw new NotFoundException(`Workspace ${id} not found`);
    return ws;
  }

  async update(
    id: string,
    membership: WorkspaceMember,
    dto: UpdateWorkspaceDto,
  ) {
    assertMinRole(membership, 'admin');

    if (dto.slug) {
      const conflict = await this.db.client
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.slug, dto.slug), sql`id != ${id}`))
        .limit(1);

      if (conflict.length)
        throw new ConflictException(`Slug '${dto.slug}' is already taken`);
    }

    const [updated] = await this.db.client
      .update(workspaces)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(workspaces.id, id))
      .returning();

    if (!updated) throw new NotFoundException(`Workspace ${id} not found`);
    return updated;
  }

  async delete(id: string, membership: WorkspaceMember) {
    assertMinRole(membership, 'owner');
    await this.db.client.delete(workspaces).where(eq(workspaces.id, id));
  }

  async getMembers(workspaceId: string) {
    return await this.db.client
      .select({
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(users.id, workspaceMembers.userId))
      .where(eq(workspaceMembers.workspaceId, workspaceId));
  }

  async removeMember(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceMember,
  ) {
    assertMinRole(actor, 'admin');

    if (targetUserId === actor.userId && actor.role === 'owner') {
      throw new BadRequestException('Owner cannot remove themselves');
    }

    const [target] = await this.db.client
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!target) throw new NotFoundException('Member not found');

    // Admins cannot remove owners
    if (target.role === 'owner' && actor.role !== 'owner') {
      throw new ForbiddenException('Only owners can remove other owners');
    }

    await this.db.client
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      );
  }

  async updateMemberRole(
    workspaceId: string,
    targetUserId: string,
    actor: WorkspaceMember,
    dto: UpdateMemberRoleDto,
  ) {
    assertMinRole(actor, 'admin');

    const [target] = await this.db.client
      .select()
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .limit(1);

    if (!target) throw new NotFoundException('Member not found');

    // Only owner can promote to admin; admin cannot touch other admins/owners
    if (
      (dto.role === 'admin' ||
        target.role === 'admin' ||
        target.role === 'owner') &&
      actor.role !== 'owner'
    ) {
      throw new ForbiddenException('Only owners can manage admin roles');
    }

    const [updated] = await this.db.client
      .update(workspaceMembers)
      .set({ role: dto.role })
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, targetUserId),
        ),
      )
      .returning();

    return updated;
  }

  async getInviteDetails(token: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [row] = await this.db.client
      .select({
        role: workspaceInvites.role,
        expiresAt: workspaceInvites.expiresAt,
        email: workspaceInvites.email,
        workspaceId: workspaces.id,
        workspaceName: workspaces.name,
        workspaceSlug: workspaces.slug,
      })
      .from(workspaceInvites)
      .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
      .where(eq(workspaceInvites.tokenHash, tokenHash))
      .limit(1);

    if (!row) throw new NotFoundException('Invite not found or already used');
    if (row.expiresAt < new Date())
      throw new BadRequestException('Invite has expired');

    return {
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      workspaceSlug: row.workspaceSlug,
      role: row.role,
      email: row.email,
      expiresAt: row.expiresAt,
    };
  }

  async createInvite(
    workspaceId: string,
    actor: WorkspaceMember,
    dto: InviteMemberDto,
  ) {
    assertMinRole(actor, 'admin');

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await this.db.client.insert(workspaceInvites).values({
      workspaceId,
      email: dto.email,
      role: dto.role,
      tokenHash,
      expiresAt,
    });

    // Fetch workspace name and actor name for the invite email
    const [ws] = await this.db.client
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const [actorUser] = await this.db.client
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, actor.userId))
      .limit(1);

    void this.mail.sendInvite({
      toEmail: dto.email,
      workspaceName: ws?.name ?? 'a workspace',
      role: dto.role,
      token: rawToken,
      inviterName: actorUser?.name ?? 'Someone',
    });

    // Return the raw token once — it is never stored and cannot be recovered from the hash
    return { email: dto.email, role: dto.role, token: rawToken, expiresAt };
  }

  async listInvites(workspaceId: string, actor: WorkspaceMember) {
    assertMinRole(actor, 'admin');

    return await this.db.client
      .select()
      .from(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.workspaceId, workspaceId),
          gt(workspaceInvites.expiresAt, new Date()),
        ),
      );
  }

  async revokeInvite(
    workspaceId: string,
    inviteId: string,
    actor: WorkspaceMember,
  ) {
    assertMinRole(actor, 'admin');

    const deleted = await this.db.client
      .delete(workspaceInvites)
      .where(
        and(
          eq(workspaceInvites.id, inviteId),
          eq(workspaceInvites.workspaceId, workspaceId),
        ),
      )
      .returning();

    if (!deleted.length) throw new NotFoundException('Invite not found');
  }

  async acceptInvite(token: string, userId: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const [invite] = await this.db.client
      .select()
      .from(workspaceInvites)
      .where(eq(workspaceInvites.tokenHash, tokenHash))
      .limit(1);

    if (!invite)
      throw new NotFoundException('Invite not found or already used');
    if (invite.expiresAt < new Date())
      throw new BadRequestException('Invite has expired');

    // Email binding — the accepting user must be the intended recipient
    const [user] = await this.db.client
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user || user.email !== invite.email) {
      throw new ForbiddenException(
        'This invite was sent to a different email address',
      );
    }

    const existingMembership = await this.db.client
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (existingMembership.length) {
      throw new ConflictException('You are already a member of this workspace');
    }

    await this.db.client.transaction(async (tx) => {
      await tx.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      });
      await tx
        .delete(workspaceInvites)
        .where(eq(workspaceInvites.id, invite.id));
    });

    return { workspaceId: invite.workspaceId, role: invite.role };
  }

  async getSettings(
    workspaceId: string,
    _actor: WorkspaceMember,
  ): Promise<WorkspaceSettings> {
    const ws = await this.findOne(workspaceId);
    return ws.settings ?? {};
  }

  async updateSettings(
    workspaceId: string,
    actor: WorkspaceMember,
    patch: Partial<WorkspaceSettings>,
  ): Promise<WorkspaceSettings> {
    assertMinRole(actor, 'admin');

    const ws = await this.findOne(workspaceId);
    const merged: WorkspaceSettings = {
      ...(ws.settings ?? {}),
      ...patch,
    };

    const [updated] = await this.db.client
      .update(workspaces)
      .set({ settings: merged, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId))
      .returning();

    return updated.settings ?? {};
  }

  async upsertFromClerkOrg(org: {
    id: string;
    name: string;
    slug: string | null;
  }) {
    const slug = org.slug ?? this.generateSlug(org.name);

    const [existing] = await this.db.client
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.clerkOrgId, org.id))
      .limit(1);

    if (existing) {
      const [updated] = await this.db.client
        .update(workspaces)
        .set({ name: org.name, updatedAt: new Date() })
        .where(eq(workspaces.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await this.db.client
      .insert(workspaces)
      .values({ name: org.name, slug, clerkOrgId: org.id })
      .returning();

    return created;
  }

  async addMemberFromClerk(
    clerkOrgId: string,
    clerkUserId: string,
    clerkRole: string,
  ) {
    const [workspace] = await this.db.client
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!workspace) return; // workspace not yet synced — skip

    const [user] = await this.db.client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!user) return; // user not yet synced — skip

    const CLERK_ROLE_MAP: Record<
      string,
      'owner' | 'admin' | 'editor' | 'viewer'
    > = {
      'org:admin': 'admin',
      'org:member': 'editor',
      'org:viewer': 'viewer',
    };
    const role = CLERK_ROLE_MAP[clerkRole] ?? 'viewer';

    await this.db.client
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role })
      .onConflictDoUpdate({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
        set: { role },
      });
  }

  async removeMemberFromClerk(clerkOrgId: string, clerkUserId: string) {
    const [workspace] = await this.db.client
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.clerkOrgId, clerkOrgId))
      .limit(1);

    if (!workspace) return;

    const [user] = await this.db.client
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!user) return;

    await this.db.client
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspace.id),
          eq(workspaceMembers.userId, user.id),
        ),
      );
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);

    return `${base}-${randomBytes(3).toString('hex')}`;
  }
}
