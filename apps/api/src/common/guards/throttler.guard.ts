import { Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// NestJS internal metadata key set by @Sse() decorator — see @nestjs/common constants.js
const NESTJS_SSE_METADATA_KEY = '__sse__';

@Injectable()
export class WorkspaceThrottlerGuard extends ThrottlerGuard {
  constructor(options: any, storageService: any, reflector: Reflector) {
    super(options, storageService, reflector);
  }

  protected async getTracker(req: Request): Promise<string> {
    // Key by workspaceId from path params only — never trust client-provided headers
    // for rate-limit bucket selection (they are attacker-controlled).
    const workspaceId = (req.params as Record<string, string>)['workspaceId'];
    if (workspaceId) return `ws:${workspaceId}`;

    // Fall back to authenticated user ID, then IP for unauthenticated routes.
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    if (userId) return `user:${userId}`;

    // req.ip respects the 'trust proxy' Express setting configured in main.ts
    return `ip:${req.ip ?? 'unknown'}`;
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    // Skip throttling only for genuine SSE endpoints (detected via NestJS route metadata).
    // Trusting the client's Accept header is not safe — any request can spoof it.
    const isSse = this.reflector.get<boolean>(
      NESTJS_SSE_METADATA_KEY,
      context.getHandler(),
    );
    if (isSse) return true;
    return super.shouldSkip(context);
  }
}
