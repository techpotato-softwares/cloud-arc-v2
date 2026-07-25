export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role?: string; // Role name (for backward compatibility)
  roleId?: number; // Role ID (foreign key)
  isActive?: boolean;
  createdById?: number;
  updatedById?: number;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: string; // Role name (for backward compatibility)
  roleId?: number; // Role ID (foreign key)
  isActive?: boolean;
  updatedById?: number;
}

import { BaseListRequest } from './BaseListRequest';

export interface ListUserRequest extends BaseListRequest {
  role?: string;
  status?: string;
}
