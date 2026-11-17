import { ForbiddenException } from '@nestjs/common';
import { Types, type ClientSession, type FilterQuery, type Model, type UpdateQuery } from 'mongoose';
import { assertSafeInput } from './safe-input';

export interface TenantScoped {
  workspaceId: Types.ObjectId;
}

export abstract class TenantRepository<T extends TenantScoped> {
  protected constructor(protected readonly model: Model<T>) {}

  protected scope(workspaceId: string | undefined | null): Types.ObjectId {
    if (!workspaceId || !Types.ObjectId.isValid(workspaceId)) {
      throw new ForbiddenException('A valid workspaceId is required');
    }
    return new Types.ObjectId(workspaceId);
  }

  async find(workspaceId: string | undefined, filter: FilterQuery<T> = {}): Promise<T[]> {
    const workspace = this.scope(workspaceId);
    assertSafeInput(filter);
    return this.model.find({ ...filter, workspaceId: workspace }).exec();
  }

  async findOne(workspaceId: string | undefined, filter: FilterQuery<T>): Promise<T | null> {
    const workspace = this.scope(workspaceId);
    assertSafeInput(filter);
    const result = await this.model.findOne({ ...filter, workspaceId: workspace }).exec();
    return result as T | null;
  }

  async create(workspaceId: string | undefined, data: Partial<T>, session?: ClientSession): Promise<T> {
    const workspace = this.scope(workspaceId);
    assertSafeInput(data);
    const [created] = await this.model.create([{ ...data, workspaceId: workspace } as T], session ? { session } : undefined);
    return created as T;
  }

  async update(
    workspaceId: string | undefined,
    filter: FilterQuery<T>,
    update: UpdateQuery<T>,
    session?: ClientSession
  ): Promise<T | null> {
    const workspace = this.scope(workspaceId);
    assertSafeInput(filter);
    assertSafeInput(update);
    const options = { new: true, runValidators: true, ...(session ? { session } : {}) };
    const result = await this.model.findOneAndUpdate({ ...filter, workspaceId: workspace }, update, options).exec();
    return result as T | null;
  }

  async delete(workspaceId: string | undefined, filter: FilterQuery<T>, session?: ClientSession): Promise<boolean> {
    const workspace = this.scope(workspaceId);
    assertSafeInput(filter);
    const options = session ? { session } : undefined;
    const result = await this.model.deleteOne({ ...filter, workspaceId: workspace }, options).exec();
    return result.deletedCount === 1;
  }
}
