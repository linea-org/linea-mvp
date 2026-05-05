import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { UsersService } from '../../users/users.service';

/**
 * Handles X-API-Key authentication for SDK / programmatic access.
 * Use ClerkAuthGuard for dashboard (JWT) auth and this guard for SDK auth.
 * Both guards can be composed via AnyAuthGuard.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly usersService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user: unknown }>();
    const key = request.headers['x-api-key'] as string | undefined;

    if (!key) throw new UnauthorizedException('Missing API key');

    const user = await this.usersService.findByApiKey(key);
    if (!user) throw new UnauthorizedException('Invalid API key');

    request.user = user;
    return true;
  }
}
