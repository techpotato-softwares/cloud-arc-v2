import { injectable, inject } from 'inversify';
import { PrismaClient, Permission, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreatePermissionRequest,
  UpdatePermissionRequest,
  ListPermissionRequest,
} from '../schemas';

// Allowed searchable fields for Permission model
const ALLOWED_SEARCH_FIELDS = ['permissionName', 'permissionCode'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'permissionName';

export interface IPermissionRepository {
  create(data: CreatePermissionRequest): Promise<Permission>;
  findById(id: number): Promise<Permission | null>;
  findAll(params: ListPermissionRequest): Promise<{ rows: Permission[]; count: number }>;
  update(id: number, data: UpdatePermissionRequest): Promise<Permission | null>;
  delete(id: number): Promise<boolean>;
}

@injectable()
export class PermissionRepository implements IPermissionRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async create(data: CreatePermissionRequest): Promise<Permission> {
    return this.prisma.permission.create({
      data: {
        permissionCode: data.permissionCode,
        permissionName: data.permissionName,
        description: data.description ?? '',
        createdById: data.createdById,
        updatedById: data.updatedById,
        isActive: data.isActive ?? true,
      },
    });
  }

  async findById(id: number): Promise<Permission | null> {
    return this.prisma.permission.findUnique({ where: { permissionId: id } });
  }

  async findAll(params: ListPermissionRequest): Promise<{ rows: Permission[]; count: number }> {
    const { page = 1, limit = 10, isActive, searchKey, searchTerm } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.PermissionWhereInput = {};
    if (isActive !== undefined) where.isActive = isActive;

    // Dynamic search implementation with default field
    if (searchTerm) {
      // If searchKey is provided, use it; otherwise use default
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;

      // Security: Validate searchKey is in allowed list
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(', ')}`
        );
      }

      // Build dynamic search condition (case-insensitive)
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: 'insensitive',
      };
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.permission.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.permission.count({ where }),
    ]);
    return { rows, count };
  }

  async update(id: number, data: UpdatePermissionRequest): Promise<Permission | null> {
    const existing = await this.prisma.permission.findUnique({ where: { permissionId: id } });
    if (!existing) return null;
    return this.prisma.permission.update({
      where: { permissionId: id },
      data: {
        ...(data.permissionCode && { permissionCode: data.permissionCode }),
        ...(data.permissionName && { permissionName: data.permissionName }),
        ...(data.description && { description: data.description }),
        updatedById: data.updatedById,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
  }

  async delete(id: number): Promise<boolean> {
    try {
      await this.prisma.permission.delete({ where: { permissionId: id } });
      return true;
    } catch {
      return false;
    }
  }
}
