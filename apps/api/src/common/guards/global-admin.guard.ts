import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@linea/db';

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: User }>();
    const user = request.user;
    if (!user) return false;

    const raw = this.config.get<string>('ADMIN_USER_IDS', '');
    const adminIds = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return adminIds.includes(user.id) || adminIds.includes(user.clerkId);
  }
}
