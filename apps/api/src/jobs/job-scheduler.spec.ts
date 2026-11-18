import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MailService } from '../auth/mail.service';
import { BackgroundJobs } from './background-jobs';
import { JobScheduler } from './job-scheduler';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';
process.env.OPS_ALERT_EMAIL ??= 'ops@example.com';
process.env.JOB_KEY_ROTATION_TARGET_ID ??= '507f1f77bcf86cd799439011';

describe('scheduled jobs', () => {
  let mail: { sendAlert: ReturnType<typeof vi.fn> };
  let jobs: ReturnType<BackgroundJobs['jobs']>;

  beforeEach(() => {
    mail = { sendAlert: vi.fn(async () => undefined) };
    const failingModel = () => ({ deleteMany: vi.fn(async () => { throw new Error('job failure'); }) });
    const background = new BackgroundJobs(
      failingModel() as any,
      failingModel() as any,
      failingModel() as any,
      { rotateDueKeys: vi.fn(async () => { throw new Error('rotation failure'); }) } as any,
      { processDueDeliveries: vi.fn(async () => { throw new Error('delivery failure'); }) } as any,
      mail as unknown as MailService
    );
    jobs = background.jobs();
  });

  it('registers every required scheduled job', () => {
    expect(jobs.map((job) => job.name)).toEqual([
      'token-expiry-cleanup',
      'key-rotation',
      'audit-retention',
      'stale-invitation-cleanup',
      'webhook-retry',
    ]);
  });

  it('sends an alert when any scheduled job fails', async () => {
    const scheduler = new JobScheduler(mail as unknown as MailService);
    for (const job of jobs) {
      mail.sendAlert.mockClear();
      await scheduler.execute(job);
      expect(mail.sendAlert).toHaveBeenCalledWith(`Scheduled job ${job.name} failed`, expect.any(String));
    }
  });

  it('does not run the same job when a Redis lock is held', async () => {
    const run = vi.fn(async () => undefined);
    const redis = {
      set: vi.fn(async () => null),
      get: vi.fn(async () => 'other-instance'),
      del: vi.fn(async () => 0),
    };
    const scheduler = new JobScheduler(mail as unknown as MailService, redis as any);
    await scheduler.execute({ name: 'token-expiry-cleanup', intervalMs: 1000, run });
    expect(run).not.toHaveBeenCalled();
    expect(mail.sendAlert).not.toHaveBeenCalled();
  });
});
