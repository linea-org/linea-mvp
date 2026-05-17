import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import type { Request } from 'express';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';

export const APP_REDIS = 'APP_REDIS';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module';
import { ConfigService } from '@nestjs/config';
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
import { PodsModule } from './pods/pods.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { MemoryModule } from './memory/memory.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SecretsModule } from './secrets/secrets.module';
import { McpModule } from './mcp/mcp.module';
import { MetricsModule } from './metrics/metrics.module';
import { QuotasModule } from './quotas/quotas.module';
import { OAuthModule } from './oauth/oauth.module';
import { PublicRunModule } from './public-run/public-run.module';
import { AgentChatModule } from './agent-chat/agent-chat.module';
import { CommentsModule } from './comments/comments.module';
import { UploadsModule } from './uploads/uploads.module';
import { BillingModule } from './billing/billing.module';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { WorkspaceThrottlerGuard } from './common/guards/throttler.guard';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';
import { ClerkWebhookController } from './auth/webhooks/clerk-webhook.controller';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const redis = redisUrl ? new Redis(redisUrl) : new Redis({ host: 'localhost', port: 6379 });
        return {
          throttlers: [
            { name: 'default', ttl: 60_000, limit: 300 },
            { name: 'execution', ttl: 60_000, limit: 60 },
          ],
          storage: new ThrottlerStorageRedisService(redis),
        };
      },
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        genReqId: (req: Request) => {
          const raw = req.headers['x-request-id'] as string | undefined;
          return raw && /^[a-zA-Z0-9\-_]{1,64}$/.test(raw) ? raw : randomUUID();
        },
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
    PodsModule,
    KnowledgeModule,
    MemoryModule,
    NotificationsModule,
    SecretsModule,
    McpModule,
    MetricsModule,
    QuotasModule,
    OAuthModule,
    PublicRunModule,
    AgentChatModule,
    CommentsModule,
    UploadsModule,
    BillingModule,
  ],
  controllers: [ClerkWebhookController],
  providers: [
    {
      provide: APP_REDIS,
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('REDIS_URL');
        return url
          ? new Redis(url)
          : new Redis({ host: 'localhost', port: 6379 });
      },
      inject: [ConfigService],
    },
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
