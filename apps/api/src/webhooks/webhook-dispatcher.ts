import { createHmac, randomUUID } from 'node:crypto';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import type { WebhookDeliveryView, WebhookEvent } from '@aegis/shared';
import { redactSensitive } from '../common/redact';
import { validateEnv } from '../config/env';
import { WebhookSecretCipher, type WebhookSecretRecord } from './webhook-secret.cipher';
import { validatePublicWebhookUrl } from './url-validation';

interface WebhookRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  url: string;
  events: string[];
  isActive: boolean;
  signingSecret: WebhookSecretRecord;
}

interface DeliveryRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  webhookId: Types.ObjectId;
  eventId: string;
  event: WebhookEvent;
  status: 'PENDING' | 'DELIVERED' | 'FAILED';
  attempts: number;
  nextAttemptAt: Date | null;
  responseStatus: number | null;
  error: string | null;
  payload: Record<string, unknown>;
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

function retryDelay(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempt - 1), 3_600_000);
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Delivery failed';
  return message.slice(0, 500);
}

export class WebhookDispatcher {
  constructor(
    private readonly webhooks: Model<WebhookRecord>,
    private readonly deliveries: Model<DeliveryRecord>,
    private readonly cipher: WebhookSecretCipher,
    private readonly fetchImpl: typeof fetch = fetch
  ) {}

  async dispatch(
    workspaceId: string,
    projectId: string,
    event: WebhookEvent,
    payload: Record<string, unknown>
  ): Promise<void> {
    const hooks = await this.webhooks
      .find({
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
        isActive: true,
        events: event,
      })
      .exec();
    const safePayload = redactSensitive(payload);

    for (const hook of hooks) {
      const [delivery] = await this.deliveries.create([
        {
          workspaceId: objectId(workspaceId),
          projectId: objectId(projectId),
          webhookId: hook._id,
          eventId: randomUUID(),
          event,
          status: 'PENDING',
          attempts: 0,
          nextAttemptAt: new Date(),
          responseStatus: null,
          error: null,
          payload: safePayload,
        },
      ]);
      await this.attemptDelivery(String(delivery._id));
    }
  }

  async processDueDeliveries(limit = 20): Promise<number> {
    const due = await this.deliveries
      .find({ status: 'PENDING', nextAttemptAt: { $lte: new Date() } })
      .sort({ nextAttemptAt: 1 })
      .limit(limit)
      .exec();
    for (const delivery of due) {
      await this.attemptDelivery(String(delivery._id));
    }
    return due.length;
  }

  async listDeliveries(workspaceId: string, projectId: string, webhookId: string): Promise<WebhookDeliveryView[]> {
    const records = await this.deliveries
      .find({
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
        webhookId: objectId(webhookId),
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();
    return records.map((delivery) => this.view(delivery));
  }

  private async attemptDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveries.findById(objectId(deliveryId)).exec();
    if (!delivery || delivery.status !== 'PENDING') {
      return;
    }
    const hook = await this.webhooks.findById(delivery.webhookId).exec();
    if (!hook || !hook.isActive) {
      await this.deliveries.updateOne(
        { _id: delivery._id },
        { $set: { status: 'FAILED', error: 'Webhook is inactive', nextAttemptAt: null } }
      );
      return;
    }

    try {
      const responseStatus = await this.send(hook, delivery);
      await this.deliveries.updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: 'DELIVERED',
            attempts: delivery.attempts + 1,
            responseStatus,
            error: null,
            nextAttemptAt: null,
          },
        }
      );
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const maxAttempts = validateEnv().WEBHOOK_MAX_ATTEMPTS;
      const failed = attempts >= maxAttempts;
      await this.deliveries.updateOne(
        { _id: delivery._id },
        {
          $set: {
            status: failed ? 'FAILED' : 'PENDING',
            attempts,
            error: safeError(error),
            responseStatus: null,
            nextAttemptAt: failed ? null : new Date(Date.now() + retryDelay(attempts)),
          },
        }
      );
    }
  }

  private async send(hook: WebhookRecord, delivery: DeliveryRecord): Promise<number> {
    await validatePublicWebhookUrl(hook.url);
    const secret = this.cipher.decrypt(
      hook.signingSecret,
      String(hook.workspaceId),
      String(hook.projectId),
      String(hook._id)
    );
    const body = JSON.stringify({
      id: delivery.eventId,
      event: delivery.event,
      createdAt: new Date().toISOString(),
      data: delivery.payload,
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    const response = await this.fetchImpl(hook.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'aegis-signature': `t=${timestamp},v1=${signature}`,
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(validateEnv().WEBHOOK_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Webhook responded with status ${response.status}`);
    }
    return response.status;
  }

  private view(delivery: DeliveryRecord): WebhookDeliveryView {
    return {
      id: String(delivery._id),
      workspaceId: String(delivery.workspaceId),
      projectId: String(delivery.projectId),
      webhookId: String(delivery.webhookId),
      eventId: delivery.eventId,
      event: delivery.event,
      status: delivery.status,
      attempts: delivery.attempts,
      nextAttemptAt: delivery.nextAttemptAt ? new Date(delivery.nextAttemptAt).toISOString() : null,
      responseStatus: delivery.responseStatus ?? null,
      error: delivery.error ?? null,
      createdAt: new Date((delivery as any).createdAt ?? Date.now()).toISOString(),
    };
  }
}
