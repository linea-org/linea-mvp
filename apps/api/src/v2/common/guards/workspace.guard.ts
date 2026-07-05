import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Database, type User, type WorkspaceMember } from '@linea/db';

export type AuthedRequest = Request & {
  user: User;
  workspace: WorkspaceMember & { workspaceSlug: string };
};

@Injectable()
export class WorkspaceGuard implements CanActivate {
  private readonly logger = new Logger(WorkspaceGuard.name);

  constructor(private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();

    const workspaceId = (req.params.workspaceId ?? req.params.id) as
      string | undefined;

    if (!workspaceId) {
      return true;
    }

    try {
      const workspaceAndMember = await this.db.workspace.findByMemberId(
        workspaceId,
        req.user.id,
      );

      if (!workspaceAndMember) {
        const workspace = await this.db.workspace.findById(workspaceId);

        if (!workspace) {
          throw new NotFoundException(
            `Workspace '${workspaceId}' was not found`,
          );
        }

        throw new ForbiddenException('You are not a member of this workspace');
      }

      req.workspace = {
        joinedAt: workspaceAndMember.member.joinedAt,
        role: workspaceAndMember.member.role,
        userId: workspaceAndMember.member.userId,
        workspaceId: workspaceAndMember.workspace.id,
        workspaceSlug: workspaceAndMember.workspace.slug,
      };

      return true;
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      this.logger.error(
        'Failed to resolve workspace membership',
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Failed to validate workspace access',
      );
    }
  }
}
