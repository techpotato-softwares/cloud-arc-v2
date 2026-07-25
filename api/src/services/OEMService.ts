import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IOEMRepository } from '../repositories/OEMRepository';
import { CreateOEMRequest, UpdateOEMRequest, ListOEMRequest } from '../schemas/request/OEMRequest';
import { OEMResponse, OEMListResponse } from '../schemas/response/OEMResponse';

export interface IOEMService {
  createOEM(data: CreateOEMRequest): Promise<OEMResponse>;
  getAllOEMs(params?: ListOEMRequest): Promise<OEMListResponse>;
  getOEMById(id: number): Promise<OEMResponse | null>;
  updateOEM(id: number, data: UpdateOEMRequest): Promise<OEMResponse>;
  deleteOEM(id: number): Promise<void>;
}

@injectable()
export class OEMService implements IOEMService {
  constructor(@inject(TYPES.OEMRepository) private repo: IOEMRepository) {}

  async createOEM(data: CreateOEMRequest): Promise<OEMResponse> {
    const created = await this.repo.create(data);
    return created;
  }

  async getAllOEMs(params?: ListOEMRequest): Promise<OEMListResponse> {
    const { page = 1, limit = 20 } = params || {};
    const { rows, count } = await this.repo.findAll(params);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getOEMById(id: number): Promise<OEMResponse | null> {
    const o = await this.repo.findById(id);
    return o;
  }

  async updateOEM(id: number, data: UpdateOEMRequest): Promise<OEMResponse> {
    const updated = await this.repo.update(id, data);
    return updated;
  }

  async deleteOEM(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
