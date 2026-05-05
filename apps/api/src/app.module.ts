import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { UsersModule } from './users/users.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { WorkflowsModule } from './workflows/workflows.module';
import { ExecutionsModule } from './executions/executions.module';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { SchedulesModule } from './schedules/schedules.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SpacesModule } from './spaces/spaces.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryModule } from './memory/memory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ClerkWebhookController } from './auth/webhooks/clerk-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        customProps: (_req, _res) => ({ context: 'HTTP' }),
        autoLogging: { ignore: (req) => req.url === '/health' },
      },
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    UsersModule,
    WorkspacesModule,
    WorkflowsModule,
    ExecutionsModule,
    ApiKeysModule,
    SchedulesModule,
    WebhooksModule,
    SpacesModule,
    KnowledgeModule,
    MemoryModule,
    NotificationsModule,
  ],
  controllers: [ClerkWebhookController],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    { provide: APP_GUARD, useClass: ClerkAuthGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
