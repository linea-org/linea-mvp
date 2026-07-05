import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { workspaces } from '@linea/db';
import { DB_TOKEN } from '../database/database.module.js';

const PLANS: Record<
  string,
  {
    name: string;
    priceUsd: number;
    executions: string;
    workflows: string;
    members: string;
    features: string[];
    polarPriceId?: string; // set via env at runtime
  }
> = {
  free: {
    name: 'Free',
    priceUsd: 0,
    executions: '500 / month',
    workflows: '5',
    members: '3',
    features: [],
  },
  pro: {
    name: 'Pro',
    priceUsd: 29,
    executions: '10,000 / month',
    workflows: 'Unlimited',
    members: '10',
    features: ['Priority support', 'Advanced analytics', 'Custom domains'],
  },
  team: {
    name: 'Team',
    priceUsd: 99,
    executions: '100,000 / month',
    workflows: 'Unlimited',
    members: '25',
    features: ['SSO', 'Audit logs', 'Dedicated support', 'SLA guarantee'],
  },
};

interface PolarSubscriptionPayload {
  type: string;
  data: {
    id: string;
    status: string;
    product?: { id: string };
    metadata?: Record<string, string>;
    subscription_id?: string;
  };
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly accessToken: string;
  private readonly webhookSecret: string;
  private readonly priceIds: Record<string, string>;
  private readonly frontendUrl: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {
    this.accessToken = config.get<string>('POLAR_ACCESS_TOKEN') ?? '';
    this.webhookSecret = config.get<string>('POLAR_WEBHOOK_SECRET') ?? '';
    this.frontendUrl =
      config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    this.priceIds = {
      pro: config.get<string>('POLAR_PRICE_ID_PRO') ?? '',
      team: config.get<string>('POLAR_PRICE_ID_TEAM') ?? '',
    };
  }

  private async polarPost<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`https://api.polar.sh${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new BadRequestException(`Polar API error: ${err}`);
    }
    return res.json() as Promise<T>;
  }

  async getPlans(workspaceId: string) {
    const plans = Object.entries(PLANS).map(([key, p]) => ({
      key,
      label: p.name,
      priceUsd: p.priceUsd,
      executions: p.executions,
      workflows: p.workflows,
      members: p.members,
      features: p.features,
    }));
    const [ws] = await this.db
      .select({ plan: workspaces.plan })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);
    return { plans, currentPlan: ws?.plan ?? 'free' };
  }

  async createCheckout(workspaceId: string, planKey: string) {
    const plan = PLANS[planKey];
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    if (plan.priceUsd === 0)
      throw new BadRequestException('Free plan does not require payment');
    if (!this.accessToken)
      throw new BadRequestException('Polar.sh not configured');

    const priceId = this.priceIds[planKey];
    if (!priceId)
      throw new BadRequestException(
        `No Polar price ID configured for plan: ${planKey}`,
      );

    const checkout = await this.polarPost<{ url: string }>('/v1/checkouts', {
      product_price_id: priceId,
      success_url: `${this.frontendUrl}/settings/billing?success=1&plan=${planKey}`,
      metadata: { workspaceId, plan: planKey },
    });

    return { url: checkout.url };
  }

  async handleWebhook(rawBody: string, signature: string) {
    /* HMAC-SHA256 verification — secret is mandatory; never skip */
    if (!this.webhookSecret) {
      throw new BadRequestException('Billing webhook secret is not configured');
    }

    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expBuf = Buffer.from(expected, 'hex');
    const sigBuf = Buffer.from(signature ?? '', 'hex');

    if (
      expBuf.length !== sigBuf.length ||
      !crypto.timingSafeEqual(expBuf, sigBuf)
    ) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const payload = JSON.parse(rawBody) as PolarSubscriptionPayload;
    this.logger.log(`Polar webhook: ${payload.type}`);

    const meta = payload.data?.metadata;
    const workspaceId = meta?.workspaceId;
    const plan = meta?.plan;

    if (
      (payload.type === 'subscription.created' ||
        payload.type === 'order.created') &&
      workspaceId &&
      plan &&
      PLANS[plan]
    ) {
      await this.db
        .update(workspaces)
        .set({ plan: plan as 'free' | 'pro' | 'team', updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
      this.logger.log(`Workspace ${workspaceId} upgraded to ${plan}`);
    }

    if (payload.type === 'subscription.revoked' && workspaceId) {
      await this.db
        .update(workspaces)
        .set({ plan: 'free', updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
      this.logger.log(
        `Workspace ${workspaceId} downgraded to free (subscription revoked)`,
      );
    }

    return { received: true };
  }
}
