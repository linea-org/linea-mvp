import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  private static readonly SAFE_ID = /^[a-zA-Z0-9\-_]{1,64}$/;

  use(req: Request, res: Response, next: NextFunction) {
    const raw = req.headers['x-request-id'] as string | undefined;
    const id =
      raw && RequestIdMiddleware.SAFE_ID.test(raw) ? raw : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  }
}
