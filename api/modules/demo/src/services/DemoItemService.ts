import { injectable, inject } from 'inversify';
import { TYPES } from '../types/svc.types';
import { IDemoItemRepository } from '../repositories/DemoItemRepository';
import { CreateDemoItemRequest, UpdateDemoItemRequest } from '../schemas/demo';

export interface IDemoItemService {
  create(data: CreateDemoItemRequest, userId?: number, tenantId?: number): Promise<unknown>;
  list(tenantId?: number): Promise<unknown>;
  get(id: number): Promise<unknown>;
  update(id: number, data: UpdateDemoItemRequest, userId?: number): Promise<unknown>;
  remove(id: number): Promise<void>;
}

@injectable()
export class DemoItemService implements IDemoItemService {
  constructor(@inject(TYPES.DemoItemRepository) private repo: IDemoItemRepository) {}

  create(data: CreateDemoItemRequest, userId?: number, tenantId?: number) {
    return this.repo.create({ ...data, createdById: userId, tenantId });
  }

  list(tenantId?: number) {
    return this.repo.findAll(tenantId);
  }

  get(id: number) {
    return this.repo.findById(id);
  }

  update(id: number, data: UpdateDemoItemRequest, userId?: number) {
    return this.repo.update(id, { ...data, updatedById: userId });
  }

  remove(id: number) {
    return this.repo.delete(id);
  }
}
