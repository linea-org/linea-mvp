import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import type { DrizzleDB, Pod } from '@linea/db';
import { pods } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';

export type PodRequest = Request & {
  pod: Pod;
};

@Injectable()
export class PodGuard implements CanActivate {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<PodRequest & { params: Record<string, string> }>();
    const workspaceId = req.params['workspaceId'];
    const podId = req.params['podId'];

    if (!podId || !workspaceId) return true;

    const [pod] = await this.db
      .select()
      .from(pods)
      .where(and(eq(pods.id, podId), eq(pods.workspaceId, workspaceId)))
      .limit(1);

    if (!pod) throw new NotFoundException(`Pod ${podId} not found`);

    req.pod = pod;
    return true;
  }
}
