import {
  Controller,
  Post,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Webhook } from 'svix';
import type { Request } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from '../../users/users.service';

interface ClerkUserPayload {
  id: string;
  email_addresses: Array<{ email_address: string; id: string }>;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
  primary_email_address_id: string;
}

@Public()
@Controller('webhooks/clerk')
export class ClerkWebhookController {
  private readonly logger = new Logger(ClerkWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
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

    let event: { type: string; data: ClerkUserPayload };

    try {
      event = wh.verify(req.rawBody!, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      }) as typeof event;
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }

    const { type, data } = event;
    this.logger.log(`Clerk webhook: ${type}`);

    if (type === 'user.created' || type === 'user.updated') {
      await this.usersService.upsertFromClerk(data);
    } else if (type === 'user.deleted') {
      await this.usersService.deleteByClerkId(data.id);
    }

    return { received: true };
  }
}
