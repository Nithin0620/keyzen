import type { BillingCheckoutView, BillingView } from '@aegis/shared';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '../common/http-error';
import { validateEnv } from '../config/env';
import type { WorkspaceAccessService } from '../workspaces/workspace-access.service';
import type { StripeEventLike, StripeEventVerifier } from './stripe-event-verifier';
import { StripeGateway } from './stripe.gateway';

type Plan = 'FREE' | 'PRO' | 'ENTERPRISE';
type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE';

interface SubscriptionRecord {
  workspaceId: Types.ObjectId;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  plan: Plan;
  status: SubscriptionStatus;
  currentPeriodEnd?: Date | null;
}

interface ProcessedEventRecord {
  eventId: string;
  workspaceId: Types.ObjectId;
  type: string;
  expiresAt: Date;
}

interface StripeObject {
  id?: string;
  customer?: string;
  subscription?: string;
  status?: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string } }> };
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function eventObject(event: StripeEventLike): StripeObject {
  return (event.data?.object ?? {}) as StripeObject;
}

function planFromPrice(priceId: string | undefined): Exclude<Plan, 'FREE'> | null {
  const env = validateEnv();
  if (priceId && priceId === env.STRIPE_PRICE_PRO) {
    return 'PRO';
  }
  if (priceId && priceId === env.STRIPE_PRICE_ENTERPRISE) {
    return 'ENTERPRISE';
  }
  return null;
}

function planFromMetadata(metadata: Record<string, string> | undefined): Exclude<Plan, 'FREE'> | null {
  return metadata?.plan === 'PRO' || metadata?.plan === 'ENTERPRISE' ? metadata.plan : null;
}

function statusFromStripe(status: string | undefined): SubscriptionStatus | null {
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ACTIVE';
    case 'canceled':
    case 'incomplete_expired':
      return 'CANCELED';
    case 'past_due':
    case 'unpaid':
    case 'incomplete':
      return 'PAST_DUE';
    default:
      return null;
  }
}

function periodEnd(value: number | undefined): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

export class BillingService {
  constructor(
    private readonly subscriptions: Model<SubscriptionRecord>,
    private readonly processedEvents: Model<ProcessedEventRecord>,
    private readonly access: WorkspaceAccessService,
    private readonly audits: AuditService,
    private readonly gateway: StripeGateway,
    private readonly verifier?: StripeEventVerifier
  ) {}

  async get(workspaceId: string): Promise<BillingView> {
    const record = await this.subscriptions.findOne({ workspaceId: objectId(workspaceId) }).exec();
    return {
      workspaceId,
      plan: record?.plan ?? 'FREE',
      status: record?.status ?? 'ACTIVE',
      currentPeriodEnd: record?.currentPeriodEnd ? new Date(record.currentPeriodEnd).toISOString() : null,
      stripeCustomerId: record?.stripeCustomerId ?? null,
      stripeSubscriptionId: record?.stripeSubscriptionId ?? null,
    };
  }

  async createCheckout(
    userId: string,
    workspaceId: string,
    plan: 'PRO' | 'ENTERPRISE',
    email?: string
  ): Promise<BillingCheckoutView> {
    await this.access.requireAdmin(userId, workspaceId);
    const existing = await this.subscriptions.findOne({ workspaceId: objectId(workspaceId) }).exec();
    let customerId = existing?.stripeCustomerId;
    if (!customerId) {
      customerId = await this.gateway.ensureCustomer(workspaceId, email);
    }
    return this.gateway.createCheckoutSession({ customerId, plan, workspaceId });
  }

  async handleWebhook(rawBody: Buffer, signature: string | undefined): Promise<void> {
    if (!this.verifier) {
      throw new BadRequestException('Stripe webhook is not configured');
    }
    const event = this.verifier.verify(rawBody, signature);
    const object = eventObject(event);
    const workspaceId = await this.workspaceForEvent(object);
    if (!workspaceId) {
      return;
    }

    try {
      await this.processedEvents.create([
        {
          eventId: event.id,
          workspaceId: objectId(workspaceId),
          type: event.type,
          expiresAt: new Date(Date.now() + 90 * 86_400_000),
        },
      ]);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return;
      }
      throw error;
    }

    try {
      await this.applyEvent(event.type, object, workspaceId);
      await this.audits.record({
        workspaceId,
        action: 'billing.webhook',
        metadata: { eventId: event.id, eventType: event.type },
        actor: { actorType: 'SYSTEM', actorId: 'stripe' },
      });
    } catch (error) {
      await this.processedEvents.deleteOne({ eventId: event.id });
      throw error;
    }
  }

  private async workspaceForEvent(object: StripeObject): Promise<string | null> {
    const metadataId = object.metadata?.workspaceId;
    if (metadataId && Types.ObjectId.isValid(metadataId)) {
      return metadataId;
    }
    if (object.customer) {
      const record = await this.subscriptions.findOne({ stripeCustomerId: object.customer }).exec();
      if (record) {
        return String(record.workspaceId);
      }
    }
    if (object.subscription) {
      const record = await this.subscriptions.findOne({ stripeSubscriptionId: object.subscription }).exec();
      if (record) {
        return String(record.workspaceId);
      }
    }
    return null;
  }

  private async applyEvent(type: string, object: StripeObject, workspaceId: string): Promise<void> {
    const workspace = objectId(workspaceId);
    if (type === 'checkout.session.completed') {
      const plan = planFromMetadata(object.metadata);
      if (!object.customer) {
        return;
      }
      await this.subscriptions.updateOne(
        { workspaceId: workspace },
        {
          $set: {
            stripeCustomerId: object.customer,
            ...(object.subscription ? { stripeSubscriptionId: object.subscription } : {}),
            ...(plan ? { plan } : {}),
            status: 'ACTIVE',
          },
        },
        { upsert: true, runValidators: true }
      );
      return;
    }

    if (type === 'customer.subscription.created' || type === 'customer.subscription.updated') {
      const plan = planFromPrice(object.items?.data?.[0]?.price?.id) ?? planFromMetadata(object.metadata);
      const status = statusFromStripe(object.status);
      const set: Record<string, unknown> = {};
      if (object.customer) set.stripeCustomerId = object.customer;
      if (object.id) set.stripeSubscriptionId = object.id;
      if (plan) set.plan = plan;
      if (status) set.status = status;
      const end = periodEnd(object.current_period_end);
      if (end) set.currentPeriodEnd = end;
      await this.subscriptions.updateOne(
        { workspaceId: workspace },
        { $set: set, $setOnInsert: { plan: 'FREE', status: 'ACTIVE' } },
        { upsert: true, runValidators: true }
      );
      return;
    }

    if (type === 'customer.subscription.deleted') {
      await this.subscriptions.updateOne(
        { workspaceId: workspace },
        {
          $set: {
            status: 'CANCELED',
            ...(object.customer ? { stripeCustomerId: object.customer } : {}),
            ...(object.id ? { stripeSubscriptionId: object.id } : {}),
            ...(periodEnd(object.current_period_end) ? { currentPeriodEnd: periodEnd(object.current_period_end) } : {}),
          },
        },
        { runValidators: true }
      );
      return;
    }

    if (type === 'invoice.payment_failed') {
      await this.subscriptions.updateOne(
        { workspaceId: workspace },
        { $set: { status: 'PAST_DUE' } },
        { runValidators: true }
      );
    }
  }
}
