import type { Model } from 'mongoose';
import { MailService } from '../auth/mail.service';
import { validateEnv } from '../config/env';
import type { KeyRotationService } from '../secrets/key-rotation.service';
import type { WebhookDispatcher } from '../webhooks/webhook-dispatcher';
import type { ScheduledJob } from './job-scheduler';

export class BackgroundJobs {
  constructor(
    private readonly serviceTokens: Model<any>,
    private readonly invitations: Model<any>,
    private readonly auditLogs: Model<any>,
    private readonly rotation: KeyRotationService,
    private readonly dispatcher: WebhookDispatcher,
    private readonly mail: MailService
  ) {}

  jobs(): ScheduledJob[] {
    const env = validateEnv();
    return [
      {
        name: 'token-expiry-cleanup',
        intervalMs: env.JOB_TOKEN_CLEANUP_INTERVAL_MS,
        run: () => this.cleanupExpiredTokens(),
      },
      {
        name: 'key-rotation',
        intervalMs: env.JOB_KEY_ROTATION_INTERVAL_MS,
        run: () => this.rotateKeys(),
      },
      {
        name: 'audit-retention',
        intervalMs: env.JOB_AUDIT_RETENTION_INTERVAL_MS,
        run: () => this.enforceAuditRetention(),
      },
      {
        name: 'stale-invitation-cleanup',
        intervalMs: env.JOB_INVITATION_CLEANUP_INTERVAL_MS,
        run: () => this.cleanupStaleInvitations(),
      },
      {
        name: 'webhook-retry',
        intervalMs: env.JOB_WEBHOOK_RETRY_INTERVAL_MS,
        run: () => this.dispatcher.processDueDeliveries(),
      },
    ];
  }

  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.serviceTokens.deleteMany({ expiresAt: { $lte: new Date() } });
    return result.deletedCount ?? 0;
  }

  async cleanupStaleInvitations(): Promise<number> {
    const result = await this.invitations.deleteMany({
      expiresAt: { $lte: new Date() },
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
    });
    return result.deletedCount ?? 0;
  }

  async enforceAuditRetention(): Promise<number> {
    const cutoff = new Date(Date.now() - validateEnv().AUDIT_RETENTION_DAYS * 86_400_000);
    const result = await this.auditLogs.deleteMany({ createdAt: { $lt: cutoff } });
    return result.deletedCount ?? 0;
  }

  async rotateKeys(): Promise<number> {
    const target = validateEnv().JOB_KEY_ROTATION_TARGET_ID;
    if (!target) {
      return 0;
    }
    return this.rotation.rotateDueKeys(target);
  }

  async sendFailureAlert(jobName: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown failure';
    await this.mail.sendAlert(`Scheduled job ${jobName} failed`, message);
  }
}
