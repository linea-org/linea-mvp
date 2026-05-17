import { Injectable, Inject, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import Razorpay from 'razorpay';
import * as crypto from 'crypto';
import type { DrizzleDB } from '@linea/db';
import { workspaces } from '@linea/db';
import { DB_TOKEN } from '../database/database.module';

export const PLANS: Record<string, {
  name: string; amount: number; currency: string;
  executions: string; workflows: string; members: string; features: string[];
}> = {
  free: {
    name: 'Free', amount: 0, currency: 'INR',
    executions: '500 / month', workflows: '5', members: '3',
    features: [],
  },
  pro: {
    name: 'Pro', amount: 299900, currency: 'INR',
    executions: '10,000 / month', workflows: 'Unlimited', members: '10',
    features: ['Priority support'],
  },
  team: {
    name: 'Team', amount: 999900, currency: 'INR',
    executions: '100,000 / month', workflows: 'Unlimited', members: '25',
    features: ['SSO', 'Audit logs', 'Dedicated support'],
  },
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly rz: Razorpay | null = null;
  private readonly keySecret: string;

  constructor(
    private readonly config: ConfigService,
    @Inject(DB_TOKEN) private readonly db: DrizzleDB,
  ) {
    const keyId = config.get<string>('RAZORPAY_KEY_ID');
    this.keySecret = config.get<string>('RAZORPAY_KEY_SECRET') ?? '';
    if (keyId && this.keySecret) {
      this.rz = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
    }
  }

  async getPlans(workspaceId: string) {
    const keyId = this.config.get<string>('RAZORPAY_KEY_ID') ?? '';
    const plans = Object.entries(PLANS).map(([key, p]) => ({
      key, label: p.name, price: p.amount, currency: p.currency,
      executions: p.executions, workflows: p.workflows, members: p.members,
      features: p.features,
    }));
    const [ws] = await this.db.select({ plan: workspaces.plan }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    return { plans, keyId, currentPlan: ws?.plan ?? 'free' };
  }

  async createOrder(workspaceId: string, planKey: string) {
    const plan = PLANS[planKey];
    if (!plan) throw new BadRequestException(`Unknown plan: ${planKey}`);
    if (plan.amount === 0) throw new BadRequestException('Free plan does not require payment');
    if (!this.rz) throw new BadRequestException('Payment gateway not configured');

    const order = await this.rz.orders.create({
      amount: plan.amount,
      currency: plan.currency,
      receipt: `ws_${workspaceId}_${planKey}_${Date.now()}`,
      notes: { workspaceId, plan: planKey },
    });

    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: this.config.get<string>('RAZORPAY_KEY_ID'),
      planName: plan.name,
    };
  }

  async verifyPayment(
    workspaceId: string,
    orderId: string,
    paymentId: string,
    signature: string,
    planKey: string,
  ) {
    if (!this.rz) throw new BadRequestException('Payment gateway not configured');

    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    if (expected !== signature) {
      throw new BadRequestException('Payment signature verification failed');
    }

    if (!PLANS[planKey]) throw new BadRequestException(`Unknown plan: ${planKey}`);

    await this.db
      .update(workspaces)
      .set({ plan: planKey as any, updatedAt: new Date() })
      .where(eq(workspaces.id, workspaceId));

    this.logger.log(`Workspace ${workspaceId} upgraded to ${planKey} via payment ${paymentId}`);
    return { success: true, plan: planKey };
  }

  async handleWebhook(payload: Record<string, unknown>, signature: string) {
    const body = JSON.stringify(payload);
    const expected = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    if (expected !== signature) {
      throw new BadRequestException('Invalid webhook signature');
    }

    const event = payload.event as string;
    this.logger.log(`Razorpay webhook: ${event}`);

    if (event === 'payment.captured') {
      const notes = (payload as any)?.payload?.payment?.entity?.notes as Record<string, string> | undefined;
      if (notes?.workspaceId && notes?.plan) {
        await this.db
          .update(workspaces)
          .set({ plan: notes.plan as any, updatedAt: new Date() })
          .where(eq(workspaces.id, notes.workspaceId));
      }
    }

    return { received: true };
  }
}
