import type { WebhookCreatedView, WebhookCreateInput, WebhookEvent, WebhookView } from '@aegis/shared';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { NotFoundException } from '../common/http-error';
import { hashToken } from '../common/tokens';
import type { ProjectAccessService } from '../projects/project-access.service';
import { WebhookDispatcher } from './webhook-dispatcher';
import { validatePublicWebhookUrl } from './url-validation';
import { generateWebhookSecret, WebhookSecretCipher, type WebhookSecretRecord } from './webhook-secret.cipher';

interface WebhookRecord {
  _id: Types.ObjectId;
  workspaceId: Types.ObjectId;
  projectId: Types.ObjectId;
  url: string;
  events: WebhookEvent[];
  isActive: boolean;
  secretHash: string;
  signingSecret: WebhookSecretRecord;
  createdAt: Date;
}

function objectId(value: string): Types.ObjectId {
  return new Types.ObjectId(value);
}

export class WebhookService {
  constructor(
    private readonly webhooks: Model<WebhookRecord>,
    private readonly cipher: WebhookSecretCipher,
    private readonly dispatcher: WebhookDispatcher,
    private readonly access: ProjectAccessService
  ) {}

  async create(
    userId: string,
    workspaceId: string,
    projectId: string,
    input: WebhookCreateInput
  ): Promise<WebhookCreatedView> {
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await validatePublicWebhookUrl(input.url);
    const id = new Types.ObjectId();
    const secret = generateWebhookSecret();
    const [created] = await this.webhooks.create([
      {
        _id: id,
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
        url: input.url,
        events: input.events,
        secretHash: hashToken(secret),
        signingSecret: this.cipher.encrypt(secret, workspaceId, projectId, String(id)),
        isActive: true,
      },
    ]);
    return { ...this.view(created), secret };
  }

  async list(userId: string, workspaceId: string, projectId: string): Promise<WebhookView[]> {
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const records = await this.webhooks
      .find({ workspaceId: objectId(workspaceId), projectId: objectId(projectId) })
      .sort({ createdAt: -1 })
      .exec();
    return records.map((record) => this.view(record));
  }

  async rotateSecret(
    userId: string,
    workspaceId: string,
    projectId: string,
    webhookId: string
  ): Promise<WebhookCreatedView> {
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const record = await this.findScoped(workspaceId, projectId, webhookId);
    const secret = generateWebhookSecret();
    const updated = await this.webhooks
      .findOneAndUpdate(
        { _id: record._id },
        {
          $set: {
            secretHash: hashToken(secret),
            signingSecret: this.cipher.encrypt(secret, workspaceId, projectId, webhookId),
          },
        },
        { new: true, runValidators: true }
      )
      .exec();
    if (!updated) {
      throw new NotFoundException();
    }
    return { ...this.view(updated), secret };
  }

  async deactivate(userId: string, workspaceId: string, projectId: string, webhookId: string): Promise<WebhookView> {
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    const updated = await this.webhooks
      .findOneAndUpdate(
        { _id: objectId(webhookId), workspaceId: objectId(workspaceId), projectId: objectId(projectId) },
        { $set: { isActive: false } },
        { new: true, runValidators: true }
      )
      .exec();
    if (!updated) {
      throw new NotFoundException();
    }
    return this.view(updated);
  }

  async deliveries(userId: string, workspaceId: string, projectId: string, webhookId: string) {
    await this.access.requireProjectAdmin(userId, workspaceId, projectId);
    await this.findScoped(workspaceId, projectId, webhookId);
    return this.dispatcher.listDeliveries(workspaceId, projectId, webhookId);
  }

  private async findScoped(workspaceId: string, projectId: string, webhookId: string): Promise<WebhookRecord> {
    const record = await this.webhooks
      .findOne({
        _id: objectId(webhookId),
        workspaceId: objectId(workspaceId),
        projectId: objectId(projectId),
      })
      .exec();
    if (!record) {
      throw new NotFoundException();
    }
    return record;
  }

  private view(record: WebhookRecord): WebhookView {
    return {
      id: String(record._id),
      workspaceId: String(record.workspaceId),
      projectId: String(record.projectId),
      url: record.url,
      events: record.events,
      isActive: record.isActive,
      createdAt: new Date(record.createdAt).toISOString(),
    };
  }
}
