import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  REQUIRE_ROLE_KEY,
  type RoleName,
} from '../decorators/require-role.decorator';

const ROLE_LEVEL: Record<string, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RoleName | undefined>(
      REQUIRE_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) return true;

    const req = context
      .switchToHttp()
      .getRequest<{ workspace?: { role: string } }>();
    const role = req.workspace?.role;

    const level = role ? (ROLE_LEVEL[role] ?? 0) : 0;
    const minLevel = ROLE_LEVEL[required] ?? Infinity;
    if (level < minLevel) {
      throw new ForbiddenException(
        `This action requires the '${required}' role or higher`,
      );
    }

    return true;
  }
}
