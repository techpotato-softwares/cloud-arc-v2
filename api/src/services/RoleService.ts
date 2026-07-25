import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IRoleRepository } from '../repositories/RoleRepository';
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  ListRoleRequest,
  RoleResponse,
  RoleListResponse,
  PermissionResponse,
} from '../schemas';
import { Role } from '@prisma/client';

export interface IRoleService {
  createRole(data: CreateRoleRequest): Promise<RoleResponse>;
  getRoleById(id: number): Promise<RoleResponse | null>;
  getAllRoles(params: ListRoleRequest): Promise<RoleListResponse>;
  updateRole(id: number, data: UpdateRoleRequest): Promise<RoleResponse | null>;
  deleteRole(id: number): Promise<boolean>;
}

@injectable()
export class RoleService implements IRoleService {
  constructor(@inject(TYPES.RoleRepository) private repo: IRoleRepository) {}

  private mapToResponse(role: unknown): RoleResponse {
    const roleWithPermissions = role as Role & {
      rolePermissions?: Array<{
        permission: {
          permissionId: number;
          permissionCode: string;
          permissionName: string;
          description: string | null;
          createdBy: string;
          updatedBy: string;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
        };
      }>;
    };

    const permissions: PermissionResponse[] =
      roleWithPermissions.rolePermissions?.map((rp) => ({
        permissionId: rp.permission.permissionId,
        permissionCode: rp.permission.permissionCode,
        permissionName: rp.permission.permissionName,
        description: rp.permission.description,
        createdBy: rp.permission.createdBy,
        updatedBy: rp.permission.updatedBy,
        isActive: rp.permission.isActive,
        createdAt: rp.permission.createdAt.toISOString(),
        updatedAt: rp.permission.updatedAt.toISOString(),
      })) || [];

    return {
      roleId: roleWithPermissions.roleId,
      roleName: roleWithPermissions.roleName,
      description: roleWithPermissions.description,
      isActive: roleWithPermissions.isActive,
      permissions,
      createdBy: roleWithPermissions.createdBy,
      updatedBy: roleWithPermissions.updatedBy,
      createdAt: roleWithPermissions.createdAt as unknown as Date,
      updatedAt: roleWithPermissions.updatedAt as unknown as Date,
    };
  }

  async createRole(data: CreateRoleRequest): Promise<RoleResponse> {
    const role = await this.repo.create(data);
    return this.mapToResponse(role);
  }

  async getRoleById(id: number): Promise<RoleResponse | null> {
    const role = await this.repo.findById(id);
    if (!role) return null;
    return this.mapToResponse(role);
  }

  async getAllRoles(params: ListRoleRequest): Promise<RoleListResponse> {
    const { page = 1, limit = 20 } = params;
    const { rows, count } = await this.repo.findAll(params);

    return {
      data: rows.map((role) => this.mapToResponse(role)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async updateRole(id: number, data: UpdateRoleRequest): Promise<RoleResponse | null> {
    const role = await this.repo.update(id, data);
    if (!role) return null;
    return this.mapToResponse(role);
  }

  async deleteRole(id: number): Promise<boolean> {
    return this.repo.delete(id);
  }
}
