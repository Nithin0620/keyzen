import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import { MailService } from '../auth/mail.service';

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  run(): Promise<number | void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown failure';
}

export class JobScheduler {
  private readonly timers: NodeJS.Timeout[] = [];
  private readonly instanceId = randomUUID();

  constructor(private readonly mail: MailService, private readonly redis?: Redis) {}

  start(jobs: ScheduledJob[]): void {
    for (const job of jobs) {
      this.timers.push(
        setInterval(() => {
          void this.execute(job);
        }, job.intervalMs)
      );
    }
  }

  stop(): void {
    for (const timer of this.timers) {
      clearInterval(timer);
    }
    this.timers.length = 0;
  }

  async execute(job: ScheduledJob): Promise<void> {
    const lockKey = `aegis:job:${job.name}`;
    if (!(await this.acquireLock(lockKey))) {
      return;
    }
    try {
      await job.run();
    } catch (error) {
      try {
        await this.mail.sendAlert(`Scheduled job ${job.name} failed`, errorMessage(error));
      } catch {
        console.error(`Failed to send alert for job ${job.name}`);
      }
    } finally {
      await this.releaseLock(lockKey);
    }
  }

  private async acquireLock(key: string): Promise<boolean> {
    if (!this.redis) {
      return true;
    }
    const result = await this.redis.set(key, this.instanceId, 'EX', 600, 'NX');
    return result === 'OK';
  }

  private async releaseLock(key: string): Promise<void> {
    if (!this.redis) {
      return;
    }
    const value = await this.redis.get(key);
    if (value === this.instanceId) {
      await this.redis.del(key);
    }
  }
}
