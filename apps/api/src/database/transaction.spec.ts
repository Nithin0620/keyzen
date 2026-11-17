import type { ClientSession, Connection } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { withTransaction } from './transaction';

function fakeConnection(session: ClientSession): Connection {
  return { startSession: vi.fn(async () => session) } as unknown as Connection;
}

function fakeSession(): ClientSession & { withTransaction: ReturnType<typeof vi.fn>; endSession: ReturnType<typeof vi.fn> } {
  return {
    withTransaction: vi.fn(async (work: () => Promise<void>) => {
      await work();
    }),
    endSession: vi.fn(async () => undefined),
  } as unknown as ClientSession & { withTransaction: ReturnType<typeof vi.fn>; endSession: ReturnType<typeof vi.fn> };
}

describe('withTransaction', () => {
  it('returns the work result and closes the session', async () => {
    const session = fakeSession();
    const result = await withTransaction(fakeConnection(session), async () => 'done');
    expect(result).toBe('done');
    expect(session.withTransaction).toHaveBeenCalledOnce();
    expect(session.endSession).toHaveBeenCalledOnce();
  });

  it('propagates a failure and still closes the session', async () => {
    const session = fakeSession();
    await expect(
      withTransaction(fakeConnection(session), async () => {
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    expect(session.endSession).toHaveBeenCalledOnce();
  });
});
