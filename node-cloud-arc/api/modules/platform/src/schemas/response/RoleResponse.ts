import { UserResponse } from './UserResponse';
import { PermissionResponse } from './PermissionResponse';
export interface RoleResponse {
  roleId: number;
  roleName: string;
  description: string | null;
  isActive: boolean;
  permissions?: PermissionResponse[];
  users?: UserResponse[];
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleListResponse {
  data: RoleResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
