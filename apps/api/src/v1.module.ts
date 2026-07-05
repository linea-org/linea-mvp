import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { Redis } from 'ioredis';

import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { LoggerModule } from 'nestjs-pino';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';
import { WorkflowsModule } from './workflows/workflows.module.js';
import { ExecutionsModule } from './executions/executions.module.js';
import { ApiKeysModule } from './api-keys/api-keys.module.js';
import { SchedulesModule } from './schedules/schedules.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { PodsModule } from './pods/pods.module.js';
import { KnowledgeModule } from './knowledge/knowledge.module.js';
import { MemoryModule } from './memory/memory.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { SecretsModule } from './secrets/secrets.module.js';
import { McpModule } from './mcp/mcp.module.js';
import { MetricsModule } from './metrics/metrics.module.js';
import { QuotasModule } from './quotas/quotas.module.js';
import { OAuthModule } from './oauth/oauth.module.js';
import { PublicRunModule } from './public-run/public-run.module.js';
import { AgentChatModule } from './agent-chat/agent-chat.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { BillingModule } from './billing/billing.module.js';
import { ModelsModule } from './models/models.module.js';
import { AuditModule } from './audit/audit.module.js';
import { MailModule } from './mail/mail.module.js';
import { ClerkAuthGuard } from './auth/guards/clerk-auth.guard.js';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter.js';
import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor.js';
import { WorkspaceThrottlerGuard } from './common/guards/throttler.guard.js';
import { ClerkWebhookController } from './auth/webhooks/clerk-webhook.controller.js';
import { ConnectionsModule } from './connections/connections.module.js';
import { AIModule } from './services/ai/ai.module.js';
import { APP_REDIS } from './tokens.js';

@Module({
  imports: [
    ConfigModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        const redis = redisUrl
          ? new Redis(redisUrl)
          : new Redis({ host: 'localhost', port: 6379 });
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
        // In production use warn level — pino-http's info logs every request
        // which creates enormous volume; warnings + errors are what matter.
        level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
        transport:
          process.env['NODE_ENV'] !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        genReqId: (req) => {
          const raw = req.headers['x-request-id'] as string | undefined;
          return raw && /^[a-zA-Z0-9\-_]{1,64}$/.test(raw) ? raw : randomUUID();
        },
        customProps: (_req, _res) => ({ context: 'HTTP' }),
        // Skip health checks and long-lived SSE/stream connections
        autoLogging: {
          ignore: (req) =>
            req.url === '/health' ||
            /\/(events|stream)(\/|$)/.test(req.url ?? ''),
        },
        // Redact credentials from request logs
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers["x-api-key"]',
            'req.headers.cookie',
            'req.query.code',
            'req.body.value',
            'req.body.accessToken',
            'req.body.refreshToken',
            'req.body.apiKey',
          ],
          censor: '[REDACTED]',
        },
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
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
    ModelsModule,
    AuditModule,
    MailModule,
    AIModule,
    ConnectionsModule,
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
  ],
})
export class V1Module {}
