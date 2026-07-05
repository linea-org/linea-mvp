import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Database, type Pod } from '@linea/db';

type PodRequest = Request & {
  pod: Pod;
};

@Injectable()
export class PodGuard implements CanActivate {
  constructor(private readonly db: Database) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<PodRequest & { params: Record<string, string> }>();
    const workspaceId = req.params['workspaceId'];
    const podId = req.params['podId'];

    if (!podId || !workspaceId) return true;

    const pod = await this.db.pod.findById(podId);

    if (!pod) throw new NotFoundException(`Pod ${podId} not found`);

    req.pod = pod;
    return true;
  }
}
