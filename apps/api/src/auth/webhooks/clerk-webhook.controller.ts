import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import type { Redis } from 'ioredis';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from '../../users/users.service';
import { WorkspacesService } from '../../workspaces/workspaces.service';
import { APP_REDIS } from '../../app.module';

interface ClerkUserPayload {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string;
}

interface ClerkOrgPayload {
  id: string;
  name: string;
  slug: string | null;
}

interface ClerkOrgMembershipPayload {
  id: string;
  organization: { id: string };
  public_user_data: { user_id: string };
  role: string;
}

@Public()
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    private readonly workspacesService: WorkspacesService,
    @Inject(APP_REDIS) private readonly redis: Redis,
  ) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Req() req: RawBodyRequest<Request>,
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
  ) {
    const secret = this.config.getOrThrow<string>('CLERK_WEBHOOK_SECRET');
    const wh = new Webhook(secret);

    let event: { type: string; data: unknown };

    try {
      event = wh.verify(req.rawBody!, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event;
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    // Idempotency check — Clerk guarantees at-least-once delivery; skip duplicates.
    // 3600s (1h) is well beyond Svix's retry window and reduces the attack surface
    // vs the previous 24h window.
    const nonceKey = `clerk-webhook:${svixId}`;
    const stored = await this.redis.set(nonceKey, '1', 'EX', 3600, 'NX');
    if (stored === null) {
      this.logger.log(`Clerk webhook duplicate skipped: ${svixId}`);
      return { received: true };
    }

    const { type, data } = event;
    this.logger.log(`Clerk webhook: ${type}`);

    switch (type) {
      case 'user.created':
      case 'user.updated':
        await this.usersService.upsertFromClerk(data as ClerkUserPayload);
        break;

      case 'user.deleted':
        await this.usersService.deleteByClerkId((data as ClerkUserPayload).id);
        break;

      case 'organization.created':
        await this.handleOrgCreated(data as ClerkOrgPayload);
        break;

      case 'organizationMembership.created':
        await this.handleMembershipCreated(data as ClerkOrgMembershipPayload);
        break;

      case 'organizationMembership.deleted':
        await this.handleMembershipDeleted(data as ClerkOrgMembershipPayload);
        break;
    }

    return { received: true };
  }

  private async handleOrgCreated(data: ClerkOrgPayload) {
    try {
      await this.workspacesService.upsertFromClerkOrg(data);
    } catch (err) {
      this.logger.warn(`Failed to upsert workspace for org ${data.id}: ${err}`);
    }
  }

  private async handleMembershipCreated(data: ClerkOrgMembershipPayload) {
    try {
      await this.workspacesService.addMemberFromClerk(
        data.organization.id,
        data.public_user_data.user_id,
        data.role,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to add member for org ${data.organization.id}: ${err}`,
      );
    }
  }

  private async handleMembershipDeleted(data: ClerkOrgMembershipPayload) {
    try {
      await this.workspacesService.removeMemberFromClerk(
        data.organization.id,
        data.public_user_data.user_id,
      );
    } catch (err) {
      this.logger.warn(
        `Failed to remove member for org ${data.organization.id}: ${err}`,
      );
    }
  }
}
