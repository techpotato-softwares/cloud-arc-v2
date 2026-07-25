export interface CreatePermissionRequest {
  permissionCode: string;
  permissionName: string;
  description?: string;
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdatePermissionRequest {
  permissionCode?: string;
  permissionName?: string;
  description?: string;
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListPermissionRequest extends BaseListRequest {
  isActive?: boolean;
}
