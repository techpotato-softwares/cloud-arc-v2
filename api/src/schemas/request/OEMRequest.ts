export interface CreateOEMRequest {
  name: string;
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdateOEMRequest {
  name?: string;
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListOEMRequest extends BaseListRequest {
  isActive?: boolean;
}
