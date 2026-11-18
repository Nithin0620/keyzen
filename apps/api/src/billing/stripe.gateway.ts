import Stripe from 'stripe';
import { BadRequestException } from '../common/http-error';
import { validateEnv } from '../config/env';

export interface StripeCheckoutInput {
  customerId: string;
  plan: 'PRO' | 'ENTERPRISE';
  workspaceId: string;
}

export class StripeGateway {
  private readonly stripe?: Stripe;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.stripe = new Stripe(apiKey);
    }
  }

  async ensureCustomer(workspaceId: string, email?: string): Promise<string> {
    const stripe = this.requireClient();
    const customer = await stripe.customers.create({
      ...(email ? { email } : {}),
      metadata: { workspaceId },
    });
    return customer.id;
  }

  async createCheckoutSession(input: StripeCheckoutInput): Promise<{ sessionId: string; url: string }> {
    const stripe = this.requireClient();
    const priceId =
      input.plan === 'PRO' ? validateEnv().STRIPE_PRICE_PRO : validateEnv().STRIPE_PRICE_ENTERPRISE;
    if (!priceId) {
      throw new BadRequestException('Stripe price is not configured');
    }
    const env = validateEnv();
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: input.customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.WEB_ORIGIN}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${env.WEB_ORIGIN}/billing`,
      client_reference_id: input.workspaceId,
      metadata: { workspaceId: input.workspaceId, plan: input.plan },
      subscription_data: { metadata: { workspaceId: input.workspaceId, plan: input.plan } },
    });
    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }
    return { sessionId: session.id, url: session.url };
  }

  private requireClient(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Stripe is not configured');
    }
    return this.stripe;
  }
}
