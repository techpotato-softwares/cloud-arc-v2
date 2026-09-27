import { injectable, inject } from "inversify";
import { PrismaClient, Role, Prisma } from "@forgearc/shared";
import { TYPES } from "../types/svc.types";
import {
  CreateRoleRequest,
  UpdateRoleRequest,
  ListRoleRequest,
} from "../schemas";

// Allowed searchable fields for Role model
const ALLOWED_SEARCH_FIELDS = ["roleName"] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = "roleName";

export interface IRoleRepository {
  create(data: CreateRoleRequest): Promise<Role>;
  findById(id: number): Promise<Role | null>;
  findAll(params: ListRoleRequest): Promise<{ rows: Role[]; count: number }>;
  update(id: number, data: UpdateRoleRequest): Promise<Role | null>;
  delete(id: number): Promise<boolean>;
  assignPermissions(
    roleId: number,
    permissionIds: number[],
    createdById?: number,
  ): Promise<void>;
  removePermissions(roleId: number, permissionIds: number[]): Promise<void>;
  syncPermissions(
    roleId: number,
    permissionIds: number[],
    updatedById?: number,
  ): Promise<void>;
}

@injectable()
export class RoleRepository implements IRoleRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async create(data: CreateRoleRequest): Promise<Role> {
    const role = await this.prisma.role.create({
      data: {
        roleName: data.roleName,
        description: data.description || "",
        createdById: data.createdById,
        updatedById: data.updatedById,
        isActive: data.isActive ?? true,
      },
    });

    // If permissions are provided, assign them
    if (data.permissionIds && data.permissionIds.length > 0) {
      await this.assignPermissions(
        role.roleId,
        data.permissionIds,
        data.createdById,
      );
    }

    // Fetch role with permissions
    return this.findById(role.roleId) as Promise<Role>;
  }

  async findById(id: number): Promise<Role | null> {
    return this.prisma.role.findUnique({
      where: { roleId: id },
      include: {
        rolePermissions: {
          where: { isActive: true },
          include: {
            permission: true,
          },
        },
      },
    });
  }

  async findAll(
    params: ListRoleRequest,
  ): Promise<{ rows: Role[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "DESC",
      isActive,
      searchKey,
      searchTerm,
    } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;

    // Dynamic search implementation with default field
    if (searchTerm) {
      // If searchKey is provided, use it; otherwise use default
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;

      // Security: Validate searchKey is in allowed list
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(", ")}`,
        );
      }

      // Build dynamic search condition (case-insensitive)
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: "insensitive",
      };
    }

    const orderBy: Prisma.RoleOrderByWithRelationInput = {};
    if (sortBy === "createdAt") {
      orderBy.createdAt = sortOrder === "ASC" ? "asc" : "desc";
    } else if (sortBy === "roleName") {
      orderBy.roleName = sortOrder === "ASC" ? "asc" : "desc";
    } else if (sortBy === "updatedAt") {
      orderBy.updatedAt = sortOrder === "ASC" ? "asc" : "desc";
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          rolePermissions: {
            where: { isActive: true },
            include: {
              permission: true,
            },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);

    return { rows, count };
  }

  async update(id: number, data: UpdateRoleRequest): Promise<Role | null> {
    const existing = await this.prisma.role.findUnique({
      where: { roleId: id },
    });

    if (!existing) return null;

    await this.prisma.role.update({
      where: { roleId: id },
      data: {
        ...(data.roleName && { roleName: data.roleName }),
        ...(data.description && { description: data.description }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        updatedById: data.updatedById,
      },
    });

    // If permissions are provided, sync them
    if (data.permissionIds !== undefined) {
      await this.syncPermissions(id, data.permissionIds, data.updatedById);
    }

    // Fetch role with permissions
    return this.findById(id);
  }

  async assignPermissions(
    roleId: number,
    permissionIds: number[],
    createdById?: number,
  ): Promise<void> {
    // Create role-permission relationships
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
        createdById,
        updatedById: createdById,
        isActive: true,
      })),
      skipDuplicates: true,
    });
  }

  async removePermissions(
    roleId: number,
    permissionIds: number[],
  ): Promise<void> {
    // Soft delete by setting isActive to false
    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: permissionIds },
      },
    });
  }

  async syncPermissions(
    roleId: number,
    permissionIds: number[],
    updatedById?: number,
  ): Promise<void> {
    // Get current active permissions
    const currentPermissions = await this.prisma.rolePermission.findMany({
      where: {
        roleId,
        isActive: true,
      },
      select: { permissionId: true },
    });

    const currentPermissionIds = currentPermissions.map(
      (rp) => rp.permissionId,
    );
    const permissionsToAdd = permissionIds.filter(
      (id) => !currentPermissionIds.includes(id),
    );
    const permissionsToRemove = currentPermissionIds.filter(
      (id) => !permissionIds.includes(id),
    );

    console.log("permissionsToAdd", permissionsToAdd);
    console.log("permissionsToRemove", permissionsToRemove);
    // Add new permissions
    if (permissionsToAdd.length > 0) {
      await this.assignPermissions(roleId, permissionsToAdd, updatedById);
    }

    // Remove permissions that are no longer in the list
    if (permissionsToRemove.length > 0) {
      await this.removePermissions(roleId, permissionsToRemove);
    }
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.role.delete({ where: { roleId: id } });
      return true;
    } catch {
      return false;
    }
  }
}
