import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AbuseMonitor } from './abuse-monitor.service';

describe('AbuseMonitor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('alerts once per threshold with a hashed actor', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    const sendAlert = vi.fn(async (_subject: string, _body: string) => undefined);
    const monitor = new AbuseMonitor({ sendAlert } as any, 2, 1_000);
    const key = 'ip:203.0.113.11';
    const actor = createHash('sha256').update(key).digest('hex').slice(0, 16);

    monitor.record(key);
    expect(sendAlert).not.toHaveBeenCalled();
    monitor.record(key);
    monitor.record(key);

    expect(sendAlert).toHaveBeenCalledTimes(1);
    expect(sendAlert.mock.calls[0][0]).toBe('Rate limit abuse detected');
    expect(sendAlert.mock.calls[0][1]).toContain(actor);
    expect(sendAlert.mock.calls[0][1]).not.toContain(key);
  });

  it('drops stale actors after the window', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const sendAlert = vi.fn(async (_subject: string, _body: string) => undefined);
    const monitor = new AbuseMonitor({ sendAlert } as any, 10, 100);

    monitor.record('ip:203.0.113.13');
    now.mockReturnValue(1_200);
    monitor.record('ip:203.0.113.14');

    expect((monitor as any).events.size).toBe(1);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('caps the number of tracked actors', () => {
    const sendAlert = vi.fn(async (_subject: string, _body: string) => undefined);
    const monitor = new AbuseMonitor({ sendAlert } as any, 10, 60_000);
    for (let index = 0; index < 10_000; index += 1) {
      monitor.record(`ip:10.1.${Math.floor(index / 256)}.${index % 256}`);
    }
    monitor.record('ip:198.51.100.2');

    expect((monitor as any).events.size).toBe(10_000);
    expect(sendAlert).not.toHaveBeenCalled();
  });

  it('resets the window before alerting again', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const sendAlert = vi.fn(async (_subject: string, _body: string) => undefined);
    const monitor = new AbuseMonitor({ sendAlert } as any, 2, 100);

    monitor.record('ip:203.0.113.12');
    monitor.record('ip:203.0.113.12');
    now.mockReturnValue(1_500);
    monitor.record('ip:203.0.113.12');
    monitor.record('ip:203.0.113.12');

    expect(sendAlert).toHaveBeenCalledTimes(2);
  });
});
