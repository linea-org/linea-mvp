import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import type { DrizzleDB, User, WorkspaceMember } from '@linea/db';
import { workspaceMembers, workspaces } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module.js';

export type AuthedRequest = Request & {
  user: User;
  workspace: WorkspaceMember & { workspaceSlug: string };
};

@Injectable()
export class WorkspaceGuard implements CanActivate {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    // Works for both /workspaces/:id routes and /workspaces/:workspaceId/... nested routes
    const workspaceId = (req.params['workspaceId'] ?? req.params['id']) as
      string | undefined;
    if (!workspaceId) return true; // Not a workspace-scoped route

    const [row] = await this.db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        joinedAt: workspaceMembers.joinedAt,
        workspaceSlug: workspaces.slug,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
      .where(
        and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, req.user.id),
        ),
      )
      .limit(1);

    if (!row) {
      // Distinguish "workspace not found" from "not a member"
      const [ws] = await this.db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (!ws)
        throw new NotFoundException(`Workspace ${workspaceId} not found`);
      throw new ForbiddenException('You are not a member of this workspace');
    }

    req.workspace = row;
    return true;
  }
}
