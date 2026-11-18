import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withAuditContext } from './audit-context';
import { AuditService } from './audit.service';

const workspaceId = '507f1f77bcf86cd799439011';
const projectId = '507f1f77bcf86cd799439012';

class FakeAuditModel {
  readonly docs: Array<Record<string, any>> = [];

  create(input: Record<string, any> | Record<string, any>[]) {
    const created = (Array.isArray(input) ? input : [input]).map((doc) => ({
      _id: doc._id ?? `audit-${this.docs.length + 1}`,
      createdAt: doc.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
      ...doc,
    }));
    this.docs.push(...created);
    return Promise.resolve(created);
  }

  find(_filter: Record<string, any>) {
    const docs = this.docs;
    return {
      sort(_sort: Record<string, any>) {
        return this;
      },
      limit(_count: number) {
        return this;
      },
      exec: async () => docs,
    };
  }
}

describe('AuditService', () => {
  let model: FakeAuditModel;
  let service: AuditService;

  beforeEach(() => {
    model = new FakeAuditModel();
    service = new AuditService(model as any);
  });

  it('records awaited audit entries with actor attribution and redacted metadata', async () => {
    await withAuditContext(
      { actorType: 'USER', actorId: 'user-1', ipHash: 'ip-hash', userAgent: 'test-agent' },
      () =>
        service.record({
          workspaceId,
          projectId,
          action: 'secrets.create',
          metadata: { secretId: 'secret-1', value: 'plaintext', token: 'raw-token' },
        })
    );
    expect(model.docs).toHaveLength(1);
    expect(model.docs[0]).toMatchObject({
      actorType: 'USER',
      actorId: 'user-1',
      action: 'secrets.create',
      ipHash: 'ip-hash',
      userAgent: 'test-agent',
    });
    expect(model.docs[0].metadata).toEqual({
      secretId: 'secret-1',
      value: '[REDACTED]',
      token: '[REDACTED]',
    });
    expect(JSON.stringify(model.docs)).not.toContain('plaintext');
  });

  it('propagates audit write failures to the caller', async () => {
    vi.spyOn(model, 'create').mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(
      service.record({
        workspaceId,
        action: 'secrets.create',
        actor: { actorType: 'SYSTEM', actorId: 'system' },
      })
    ).rejects.toThrow('audit unavailable');
  });

  it('lists audit entries with redacted metadata', async () => {
    model.docs.push({
      _id: 'audit-1',
      workspaceId,
      projectId,
      actorType: 'USER',
      actorId: 'user-1',
      action: 'secrets.reveal',
      metadata: { value: 'plaintext' },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const entries = await service.list(workspaceId, { projectId, limit: 50 });
    expect(entries[0].action).toBe('secrets.reveal');
    expect(entries[0].metadata.value).toBe('[REDACTED]');
    expect(JSON.stringify(entries)).not.toContain('plaintext');
  });
});
