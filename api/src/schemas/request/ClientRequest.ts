export interface CreateClientRequest {
  clientName: string;
  clientAddress?: string;
  clientContact?: string;
  clientGST?: string;
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdateClientRequest {
  clientName?: string;
  clientAddress?: string;
  clientContact?: string;
  clientGST?: string;
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListClientRequest extends BaseListRequest {
  isActive?: boolean;
}
