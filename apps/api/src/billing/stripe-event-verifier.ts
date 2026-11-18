import Stripe from 'stripe';
import { BadRequestException } from '../common/http-error';

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: unknown };
}

export interface StripeEventVerifier {
  verify(rawBody: Buffer, signature: string | undefined): StripeEventLike;
}

export class StripeSdkEventVerifier implements StripeEventVerifier {
  private readonly stripe: Stripe;

  constructor(apiKey: string, private readonly webhookSecret: string) {
    this.stripe = new Stripe(apiKey);
  }

  verify(rawBody: Buffer, signature: string | undefined): StripeEventLike {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }
    try {
      return this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret) as StripeEventLike;
    } catch {
      throw new BadRequestException('Invalid Stripe signature');
    }
  }
}
