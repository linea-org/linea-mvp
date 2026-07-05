import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';

import { V1Module } from './v1.module.js';
import { V2Module } from './v2/v2.module.js';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClerkAuthGuard } from './v2/common/guards/clerk-auth.guard.js';
import { WorkspaceThrottlerGuard } from './v2/common/guards/throttler.guard.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';

@Module({
  imports: [
    // legacy routes /v1
    V1Module,
    // new routes /v2
    V2Module,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
    { provide: APP_GUARD, useClass: WorkspaceThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
