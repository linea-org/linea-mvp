import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthedRequest } from '../guards/workspace.guard.js';

export const WorkspaceMembership = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    return req.workspace;
  },
);
