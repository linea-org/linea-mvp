import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { webhooks, spaces, workflows } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';
import { ExecutionsService } from '../executions/executions.service';
import type { CreateWebhookDto } from './dto/create-webhook.dto';

@Injectable()
export class WebhooksService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
    private readonly executionsService: ExecutionsService,
  ) {}

  async create(spaceId: string, dto: CreateWebhookDto) {
    const [wf] = await this.db
      .select({ id: workflows.id })
      .from(workflows)
      .where(and(eq(workflows.id, dto.workflowId), eq(workflows.spaceId, spaceId)))
      .limit(1);

    if (!wf) throw new NotFoundException(`Workflow ${dto.workflowId} not found`);

    const secretToken = randomBytes(24).toString('hex');

    const [record] = await this.db
      .insert(webhooks)
      .values({ spaceId, workflowId: dto.workflowId, secretToken })
      .returning();

    return record;
  }

  async findAll(spaceId: string) {
    return this.db
      .select({
        id: webhooks.id,
        workflowId: webhooks.workflowId,
        createdAt: webhooks.createdAt,
      })
      .from(webhooks)
      .where(eq(webhooks.spaceId, spaceId));
  }

  async delete(spaceId: string, id: string) {
    const [row] = await this.db
      .select({ id: webhooks.id })
      .from(webhooks)
      .where(and(eq(webhooks.id, id), eq(webhooks.spaceId, spaceId)))
      .limit(1);

    if (!row) throw new NotFoundException(`Webhook ${id} not found`);

    await this.db.delete(webhooks).where(eq(webhooks.id, id));
  }

  async trigger(id: string, secret: string, body: Record<string, unknown>) {
    const [row] = await this.db
      .select({
        id: webhooks.id,
        spaceId: webhooks.spaceId,
        workspaceId: spaces.workspaceId,
        workflowId: webhooks.workflowId,
        secretToken: webhooks.secretToken,
      })
      .from(webhooks)
      .innerJoin(spaces, eq(spaces.id, webhooks.spaceId))
      .where(eq(webhooks.id, id))
      .limit(1);

    if (!row) throw new NotFoundException(`Webhook ${id} not found`);
    if (row.secretToken !== secret) throw new UnauthorizedException('Invalid webhook secret');

    return this.executionsService.createFromTrigger(
      row.spaceId,
      row.workspaceId,
      row.workflowId,
      'webhook',
      body,
    );
  }
}
