import { Module } from '@nestjs/common';
import { WorkflowModule } from './workflows/workflow.module.js';
import { QueueModule } from './services/queue/queue.module.js';
import { DatabaseModule } from './services/database/database.module.js';
import { ConfigModule } from './services/config/config.module.js';
import { WorkspacesModule } from './workspace/workspaces.module.js';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { MailModule } from '../mail/mail.module.js';
import { PodsModule } from './pods/pods.module.js';
import { UsersModule } from './users/users.module.js';
import { ExecutionsModule } from './executions/executions.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    QueueModule,

    WorkspacesModule,
    WorkflowModule,
    ExecutionsModule,
    PodsModule,
    UsersModule,
    MailModule,
    LoggerModule.forRoot({
      pinoHttp: {
        // In production use warn level — pino-http's info logs every request
        // which creates enormous volume; warnings + errors are what matter.
        // level: '',
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
  ],
})
export class V2Module {}
