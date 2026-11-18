import { createHash } from 'node:crypto';
import type { MailService } from '../auth/mail.service';

const MAX_ACTORS = 10_000;

type AlertSink = Pick<MailService, 'sendAlert'>;

export class AbuseMonitor {
  private readonly events = new Map<string, number[]>();

  constructor(
    private readonly mail: AlertSink,
    private readonly threshold = 10,
    private readonly windowMs = 300_000
  ) {}

  record(key: string): void {
    const now = Date.now();
    const actor = createHash('sha256').update(key).digest('hex').slice(0, 16);
    const recent = (this.events.get(actor) ?? []).filter((timestamp) => timestamp > now - this.windowMs);
    for (const [id, timestamps] of this.events) {
      if (timestamps.length === 0 || timestamps.every((timestamp) => timestamp <= now - this.windowMs)) {
        this.events.delete(id);
      }
    }
    if (this.events.size >= MAX_ACTORS) {
      const oldest = this.events.keys().next();
      if (!oldest.done) {
        this.events.delete(oldest.value);
      }
    }
    recent.push(now);
    this.events.set(actor, recent);
    if (recent.length !== this.threshold) {
      return;
    }
    void this.mail
      .sendAlert('Rate limit abuse detected', `Hashed actor ${actor} exceeded ${this.threshold} rate limit rejections.`)
      .catch(() => undefined);
  }
}
