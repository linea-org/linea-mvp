import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes, createHmac, timingSafeEqual } from 'crypto';
import type { Redis } from 'ioredis';
import type { DrizzleDB } from '@linea/db';
import { webhooks, pods, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';
import type { CreateWebhookDto } from './dto/create-webhook.dto';

export const WEBHOOK_REDIS = 'WEBHOOK_REDIS';

const REPLAY_WINDOW_SECONDS = 300; // 5 minutes
const NONCE_TTL_SECONDS = 600; // must be > REPLAY_WINDOW_SECONDS

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    @Inject(WEBHOOK_REDIS) private readonly redis: Redis,
    private readonly executionsService: ExecutionsService,
  ) {}

  async create(podId: string, dto: CreateWebhookDto) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, dto.workflowId), eq(workflows.podId, podId)))
      .limit(1);

    if (!wf)
      throw new NotFoundException(`Workflow ${dto.workflowId} not found`);

    const secretToken = randomBytes(24).toString('hex');

    const [record] = await this.db
      .insert(webhooks)
      .values({ podId, workflowId: dto.workflowId, secretToken })
      .returning();

    return record;
  }

  async findAll(podId: string) {
    return this.db
      .select({
        id: webhooks.id,
        workflowId: webhooks.workflowId,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.podId, podId));
  }

  async rotate(podId: string, id: string) {
    const [row] = await this.db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Webhook ${id} not found`);

    const secretToken = randomBytes(24).toString('hex');
    await this.db.update(webhooks).set({ secretToken }).where(eq(webhooks.id, id));
    return { secretToken };
  }

  async delete(podId: string, id: string) {
    const [row] = await this.db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.podId, podId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Webhook ${id} not found`);

    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async trigger(
    id: string,
    signature: string,
    timestamp: string,
    rawBody: Buffer,
    body: Record<string, unknown>,
  ) {
    // Timestamp window check — prevents delayed replay attacks
    const ts = parseInt(timestamp, 10);
    if (
      !Number.isFinite(ts) ||
      Math.abs(Math.floor(Date.now() / 1000) - ts) > REPLAY_WINDOW_SECONDS
    ) {
      throw new UnauthorizedException(
        'Webhook timestamp out of allowed 5-minute window',
      );
    }

    const [row] = await this.db
      .select({
        id: webhooks.id,
        podId: webhooks.podId,
        workspaceId: pods.workspaceId,
        workflowId: webhooks.workflowId,
        secretToken: webhooks.secretToken,
      })
      .from(webhooks)
      .innerJoin(pods, eq(pods.id, webhooks.podId))
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!row) throw new NotFoundException(`Webhook ${id} not found`);

    const sigHex = createHmac('sha256', row.secretToken)
      .update(rawBody)
      .digest('hex');
    const expected = `sha256=${sigHex}`;
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature ?? '');
    if (
      expectedBuf.length !== signatureBuf.length ||
      !timingSafeEqual(expectedBuf, signatureBuf)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Nonce check — prevents exact-request replay within the time window
    const nonceKey = `webhook-nonce:${id}:${ts}:${sigHex}`;
    const stored = await this.redis.set(
      nonceKey,
      '1',
      'EX',
      NONCE_TTL_SECONDS,
      'NX',
    );
    if (stored === null) {
      throw new UnauthorizedException('Webhook replay detected');
    }

    return this.executionsService.createFromTrigger(
      row.podId,
      row.workspaceId,
      row.workflowId,
      'webhook',
      body,
    );
  }
}
