import { ForbiddenException } from '@nestjs/common';
import { Types, type Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
import { UnsafeInputError } from './safe-input';
import { TenantRepository, type TenantScoped } from './tenant.repository';

class TestRepository extends TenantRepository<TenantScoped> {
  constructor(model: Model<TenantScoped>) {
    super(model);
  }
}

function fakeModel(): Model<TenantScoped> {
  return {
    find: vi.fn((filter: unknown) => ({ exec: () => Promise.resolve([filter]) })),
    findOne: vi.fn((filter: unknown) => ({ exec: () => Promise.resolve(filter) })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    findOneAndUpdate: vi.fn((filter: unknown) => ({ exec: () => Promise.resolve(filter) })),
    deleteOne: vi.fn(() => ({ exec: () => Promise.resolve({ deletedCount: 1 }) })),
  } as unknown as Model<TenantScoped>;
}

describe('TenantRepository', () => {
  const workspaceId = new Types.ObjectId().toHexString();

  it('refuses a query without a verified workspace scope', async () => {
    const repository = new TestRepository(fakeModel());
    await expect(repository.find(undefined)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses an invalid workspace scope', async () => {
    const repository = new TestRepository(fakeModel());
    await expect(repository.find('not-an-object-id')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('injects the workspace scope into filters', async () => {
    const repository = new TestRepository(fakeModel());
    const result = await repository.find(workspaceId, { name: 'DATABASE_URL' } as never);
    expect(result[0]).toMatchObject({ name: 'DATABASE_URL', workspaceId: new Types.ObjectId(workspaceId) });
  });

  it('overrides a workspaceId supplied in the filter', async () => {
    const repository = new TestRepository(fakeModel());
    const other = new Types.ObjectId().toHexString();
    const result = await repository.find(workspaceId, { workspaceId: new Types.ObjectId(other) } as never);
    expect((result[0] as TenantScoped).workspaceId.toHexString()).toBe(workspaceId);
  });

  it('injects the workspace scope into created documents', async () => {
    const repository = new TestRepository(fakeModel());
    const result = await repository.create(workspaceId, { name: 'x' } as never);
    expect(result).toMatchObject({ name: 'x', workspaceId: new Types.ObjectId(workspaceId) });
  });

  it('rejects operator injection in filters', async () => {
    const repository = new TestRepository(fakeModel());
    await expect(repository.find(workspaceId, { $where: '1 === 1' } as never)).rejects.toBeInstanceOf(UnsafeInputError);
  });
});
