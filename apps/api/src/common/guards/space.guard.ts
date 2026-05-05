import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import type { DrizzleDB, Space } from '@linea/db';
import { spaces } from '@linea/db';
import { DB_TOKEN } from '../../database/database.module';

export type SpacedRequest = Request & {
  space: Space;
};

@Injectable()
export class SpaceGuard implements CanActivate {
  constructor(@Inject(DB_TOKEN) private readonly db: DrizzleDB) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SpacedRequest & { params: Record<string, string> }>();
    const workspaceId = req.params['workspaceId'];
    const spaceId = req.params['spaceId'];

    if (!spaceId || !workspaceId) return true;

    const [space] = await this.db
      .select()
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.workspaceId, workspaceId)))
      .limit(1);

    if (!space) throw new NotFoundException(`Space ${spaceId} not found`);

    req.space = space;
    return true;
  }
}
