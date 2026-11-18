import { createHmac } from 'node:crypto';
import type { Model } from 'mongoose';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { lookupMock } = vi.hoisted(() => ({ lookupMock: vi.fn() }));
vi.mock('node:dns/promises', () => ({ lookup: lookupMock }));

import { WebhookDispatcher } from './webhook-dispatcher';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI ??= 'mongodb://localhost:27017/aegis-test';
process.env.AUTH_SECRET ??= 'test-auth-secret-with-at-least-32-chars';
process.env.WEBHOOK_SECRET_ENCRYPTION_KEY ??= 'test-webhook-encryption-key-with-32-chars';

const WORKSPACE_ID = '507f1f77bcf86cd799439011';
const PROJECT_ID = '507f1f77bcf86cd799439012';
const SIGNING_SECRET = 'whsec_test_signing_secret';

class Query<T> {
  constructor(private readonly run: () => Promise<T>) {}

  sort(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  exec(): Promise<T> {
    return this.run();
  }
}

class FakeModel {
  readonly docs: Array<Record<string, any>> = [];

  create(records: Array<Record<string, any>>): Array<Record<string, any>> {
    const created = records.map((record) => ({ _id: new Types.ObjectId(), ...record }));
    this.docs.push(...created);
    return created;
  }

  find(filter: Record<string, any>): Query<Array<Record<string, any>>> {
    return new Query(async () => this.docs.filter((doc) => matches(doc, filter)));
  }

  findById(id: unknown): Query<Record<string, any> | null> {
    return new Query(async () => this.docs.find((doc) => String(doc._id) === String(id)) ?? null);
  }

  updateOne(filter: Record<string, any>, update: Record<string, any>): Promise<Record<string, unknown>> {
    const doc = this.docs.find((entry) => matches(entry, filter));
    if (doc && update.$set) {
      Object.assign(doc, update.$set);
    }
    return Promise.resolve({ acknowledged: true });
  }
}

function matches(doc: Record<string, any>, filter: Record<string, any>): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const actual = doc[key];
    if (expected && typeof expected === 'object' && '$lte' in expected) {
      return new Date(actual).getTime() <= new Date(expected.$lte).getTime();
    }
    if (Array.isArray(actual)) {
      return actual.includes(expected);
    }
    return String(actual) === String(expected);
  });
}

describe('WebhookDispatcher', () => {
  let webhooks: FakeModel;
  let deliveries: FakeModel;
  let fetchMock: ReturnType<typeof vi.fn>;
  let dispatcher: WebhookDispatcher;

  beforeEach(() => {
    lookupMock.mockReset();
    lookupMock.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
    webhooks = new FakeModel();
    deliveries = new FakeModel();
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    dispatcher = new WebhookDispatcher(
      webhooks as unknown as Model<any>,
      deliveries as unknown as Model<any>,
      { decrypt: vi.fn(() => SIGNING_SECRET) } as any,
      fetchMock as any
    );
  });

  function addHook(url: string): Types.ObjectId {
    const [hook] = webhooks.create([
      {
        workspaceId: new Types.ObjectId(WORKSPACE_ID),
        projectId: new Types.ObjectId(PROJECT_ID),
        url,
        events: ['secret.created'],
        isActive: true,
        signingSecret: {},
      },
    ]);
    return hook._id;
  }

  it('signs payloads with HMAC and never includes raw secret values', async () => {
    addHook('https://hooks.example.com/aegis');
    await dispatcher.dispatch(WORKSPACE_ID, PROJECT_ID, 'secret.created', {
      secretId: '507f1f77bcf86cd799439013',
      value: 'super-secret-value',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.example.com/aegis');
    const body = options.body as string;
    expect(body).toContain('secret.created');
    expect(body).toContain('507f1f77bcf86cd799439013');
    expect(body).not.toContain('super-secret-value');
    expect(body).toContain('[REDACTED]');

    const header = options.headers['aegis-signature'] as string;
    const timestamp = /t=(\d+)/.exec(header)?.[1];
    const signature = /v1=([a-f0-9]+)/.exec(header)?.[1];
    expect(timestamp).toBeDefined();
    expect(signature).toBe(createHmac('sha256', SIGNING_SECRET).update(`${timestamp}.${body}`).digest('hex'));
    expect(deliveries.docs[0].status).toBe('DELIVERED');
  });

  it('blocks delivery to a private address before fetching', async () => {
    addHook('https://169.254.169.254/latest/meta-data');
    await dispatcher.dispatch(WORKSPACE_ID, PROJECT_ID, 'secret.created', { secretId: 'secret' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(deliveries.docs[0].status).toBe('PENDING');
    expect(deliveries.docs[0].error).toContain('private address');
  });

  it('retries failed deliveries with backoff and records success', async () => {
    addHook('https://hooks.example.com/aegis');
    fetchMock.mockRejectedValueOnce(new Error('temporary failure'));
    await dispatcher.dispatch(WORKSPACE_ID, PROJECT_ID, 'secret.created', { secretId: 'secret' });
    expect(deliveries.docs[0].status).toBe('PENDING');
    expect(deliveries.docs[0].attempts).toBe(1);
    expect(new Date(deliveries.docs[0].nextAttemptAt).getTime()).toBeGreaterThan(Date.now());

    deliveries.docs[0].nextAttemptAt = new Date(Date.now() - 1);
    const processed = await dispatcher.processDueDeliveries();
    expect(processed).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(deliveries.docs[0].status).toBe('DELIVERED');
    expect(deliveries.docs[0].attempts).toBe(2);
  });
});
