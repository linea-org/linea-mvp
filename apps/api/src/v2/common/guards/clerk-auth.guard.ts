import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { verifyToken } from '@clerk/backend';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { Database } from '@linea/db';

@Injectable()
export class ClerkAuthGuard implements CanActivate {
  private readonly logger = new Logger(ClerkAuthGuard.name);
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
    private readonly db: Database,
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
    const token = this.extractBearerToken(request);

    if (!token) throw new UnauthorizedException('Missing bearer token');

    // Linea SDK key fallback
    if (token.startsWith('lnk_')) {
      const user = await this.db.user.findByAPIKey(token);
      if (!user) throw new UnauthorizedException('Invalid API key');
      request.user = user;
      return true;
    }

    try {
      const secretKey = this.config.getOrThrow<string>('CLERK_SECRET_KEY');
      const authorizedParties = this.config
        .get<string>('ALLOWED_ORIGINS', 'http://localhost:3000')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload = await verifyToken(token, {
        secretKey,
        authorizedParties,
      });

      let user = await this.db.user.findByClerkId(payload.sub);

      if (user == null) {
        // todo! bad remove this
        user = await this.db.user.create({
          clerkId: payload.sub,
          email: `${payload.sub}@pending.linea`,
        });
      }

      if (user == null) return false;

      request.user = user;
      return true;
    } catch (e) {
      throw new UnauthorizedException(`Invalid or expired token: ${e}`);
    }
  }

  private extractBearerToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7);
  }
}
