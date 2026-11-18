import { z } from 'zod';
import { projectIdParamSchema } from './projects';
import { objectIdSchema } from './workspaces';

export const webhookIdParamSchema = projectIdParamSchema.extend({ webhookId: objectIdSchema });

export const billingPlanSchema = z.enum(['PRO', 'ENTERPRISE']);
export const billingCheckoutSchema = z.object({ plan: billingPlanSchema }).strict();
export type BillingCheckoutInput = z.infer<typeof billingCheckoutSchema>;

export interface BillingView {
  workspaceId: string;
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  status: 'ACTIVE' | 'CANCELED' | 'PAST_DUE';
  currentPeriodEnd: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

export interface BillingCheckoutView {
  sessionId: string;
  url: string;
}

export const webhookEventSchema = z.enum([
  'secret.created',
  'secret.updated',
  'secret.deleted',
  'service_token.created',
  'service_token.rotated',
  'service_token.revoked',
]);

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookCreateSchema = z
  .object({
    url: z.string().url().max(2048),
    events: z.array(webhookEventSchema).min(1).max(20),
  })
  .strict();

export type WebhookCreateInput = z.infer<typeof webhookCreateSchema>;

export interface WebhookView {
  id: string;
  workspaceId: string;
  projectId: string;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  createdAt: string;
}

export interface WebhookCreatedView extends WebhookView {
  secret: string;
}

export interface WebhookDeliveryView {
  id: string;
  workspaceId: string;
  projectId: string;
  webhookId: string;
  eventId: string;
  event: WebhookEvent;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  nextAttemptAt: string | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: string;
}
