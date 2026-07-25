export interface CreateProductRequest {
  productName: string;
  categoryId: number;
  oemId: number;
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdateProductRequest {
  productName?: string;
  categoryId?: number;
  oemId?: number;
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListProductRequest extends BaseListRequest {
  isActive?: boolean;
  categoryId?: number | string;
  oemId?: number | string;
}
