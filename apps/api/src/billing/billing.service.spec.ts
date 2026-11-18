import { createHmac } from 'node:crypto';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '../common/http-error';
import { BillingService } from './billing.service';
import { StripeSdkEventVerifier } from './stripe-event-verifier';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';
process.env.STRIPE_SECRET_KEY ??= 'sk_test_fake_key';
process.env.STRIPE_WEBHOOK_SECRET ??= 'whsec_test_fake_secret';
process.env.STRIPE_PRICE_PRO ??= 'price_pro';
process.env.STRIPE_PRICE_ENTERPRISE ??= 'price_enterprise';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

function signedBody(event: Record<string, unknown>): { body: Buffer; signature: string } {
  const body = JSON.stringify(event);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = createHmac('sha256', WEBHOOK_SECRET!).update(`${timestamp}.${body}`).digest('hex');
  return { body: Buffer.from(body), signature: `t=${timestamp},v1=${signature}` };
}

function checkoutEvent(): Record<string, unknown> {
  return {
    id: 'evt_test_checkout',
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_test',
        subscription: 'sub_test',
        metadata: { workspaceId: WORKSPACE_ID, plan: 'PRO' },
      },
    },
  };
}

describe('BillingService', () => {
  let subscriptions: { findOne: ReturnType<typeof vi.fn>; updateOne: ReturnType<typeof vi.fn> };
  let processedEvents: { create: ReturnType<typeof vi.fn>; deleteOne: ReturnType<typeof vi.fn> };
  let audits: { record: ReturnType<typeof vi.fn> };
  let access: { requireAdmin: ReturnType<typeof vi.fn> };
  let gateway: { ensureCustomer: ReturnType<typeof vi.fn>; createCheckoutSession: ReturnType<typeof vi.fn> };
  let service: BillingService;

  beforeEach(() => {
    subscriptions = {
      findOne: vi.fn(() => ({ exec: vi.fn(async () => null) })),
      updateOne: vi.fn(async () => ({ acknowledged: true })),
    };
    processedEvents = {
      create: vi.fn(async () => [{}]),
      deleteOne: vi.fn(async () => ({ acknowledged: true })),
    };
    audits = { record: vi.fn(async () => undefined) };
    access = { requireAdmin: vi.fn(async () => undefined) };
    gateway = {
      ensureCustomer: vi.fn(async () => 'cus_test'),
      createCheckoutSession: vi.fn(async () => ({ sessionId: 'cs_test', url: 'https://checkout.stripe.com/c/pay' })),
    };
    service = new BillingService(
      subscriptions as unknown as Model<any>,
      processedEvents as unknown as Model<any>,
      access as any,
      audits as any,
      gateway as any,
      new StripeSdkEventVerifier(process.env.STRIPE_SECRET_KEY!, WEBHOOK_SECRET!)
    );
  });

  it('rejects a forged webhook signature without changing billing state', async () => {
    const event = signedBody(checkoutEvent());
    await expect(service.handleWebhook(event.body, 't=1,v1=deadbeef')).rejects.toThrow(BadRequestException);
    expect(processedEvents.create).not.toHaveBeenCalled();
    expect(subscriptions.updateOne).not.toHaveBeenCalled();
    expect(audits.record).not.toHaveBeenCalled();
  });

  it('rejects a webhook without a signature', async () => {
    const event = signedBody(checkoutEvent());
    await expect(service.handleWebhook(event.body, undefined)).rejects.toThrow('Missing Stripe signature');
    expect(subscriptions.updateOne).not.toHaveBeenCalled();
  });

  it('changes plan only from a verified webhook', async () => {
    const event = signedBody(checkoutEvent());
    await service.handleWebhook(event.body, event.signature);
    expect(subscriptions.updateOne).toHaveBeenCalledWith(
      { workspaceId: expect.any(Object) },
      expect.objectContaining({ $set: expect.objectContaining({ plan: 'PRO', status: 'ACTIVE' }) }),
      expect.any(Object)
    );
    expect(audits.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'billing.webhook', workspaceId: WORKSPACE_ID })
    );
  });

  it('ignores duplicate webhook events', async () => {
    processedEvents.create.mockRejectedValueOnce({ code: 11000 });
    const event = signedBody(checkoutEvent());
    await service.handleWebhook(event.body, event.signature);
    expect(subscriptions.updateOne).not.toHaveBeenCalled();
  });

  it('does not mutate local billing state during checkout', async () => {
    const result = await service.createCheckout('507f1f77bcf86cd799439099', WORKSPACE_ID, 'PRO', 'owner@example.com');
    expect(result.url).toBe('https://checkout.stripe.com/c/pay');
    expect(gateway.ensureCustomer).toHaveBeenCalledWith(WORKSPACE_ID, 'owner@example.com');
    expect(gateway.createCheckoutSession).toHaveBeenCalledWith({
      customerId: 'cus_test',
      plan: 'PRO',
      workspaceId: WORKSPACE_ID,
    });
    expect(subscriptions.updateOne).not.toHaveBeenCalled();
  });

  it('reads plan and status from the database', async () => {
    subscriptions.findOne.mockReturnValueOnce({
      exec: vi.fn(async () => ({ plan: 'PRO', status: 'PAST_DUE', currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z') })),
    });
    const view = await service.get(WORKSPACE_ID);
    expect(view.plan).toBe('PRO');
    expect(view.status).toBe('PAST_DUE');
    expect(view.currentPeriodEnd).toBe('2026-02-01T00:00:00.000Z');
  });
});
