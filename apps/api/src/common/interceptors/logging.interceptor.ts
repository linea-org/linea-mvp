import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request } from 'express';

const SLOW_REQUEST_MS = 2000;

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          if (ms > SLOW_REQUEST_MS) {
            this.logger.warn(`Slow: ${req.method} ${req.path} ${ms}ms`, {
              requestId: req.headers['x-request-id'],
              ms,
            });
          }
        },
        error: (err: unknown) => {
          const ms = Date.now() - start;
          this.logger.error(
            `Error: ${req.method} ${req.path} ${ms}ms — ${err instanceof Error ? err.message : String(err)}`,
            { requestId: req.headers['x-request-id'], ms },
          );
        },
      }),
    );
  }
}
