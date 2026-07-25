export interface CreateCategoryRequest {
  categoryName: string;
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdateCategoryRequest {
  categoryName?: string;
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListCategoryRequest extends BaseListRequest {
  isActive?: boolean;
}
