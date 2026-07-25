import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { PrismaClient, User, Prisma } from '@prisma/client';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ListUserRequest,
} from '../schemas/request/UserRequest';

// Allowed searchable fields for User model
const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'username';

export interface IUserRepository {
  findAll(params?: ListUserRequest): Promise<{ rows: User[]; count: number }>;
  findById(id: number): Promise<User | null>;
  update(id: number, data: UpdateUserRequest): Promise<User>;
  delete(id: number): Promise<void>;
  create(data: CreateUserRequest): Promise<User>;
}

@injectable()
export class UserRepository implements IUserRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async create(data: CreateUserRequest): Promise<User> {
    const { role, roleId, ...userData } = data;
    let finalRoleId: number | undefined = roleId;

    // If roleId is not provided but role name is, find the role by name
    if (!finalRoleId && role) {
      const roleRecord = await this.prisma.role.findFirst({
        where: {
          roleName: role,
          isActive: true,
        },
      });

      if (roleRecord) {
        finalRoleId = roleRecord.roleId;
      }
    }

    // Create user with roleId (1-to-1 relationship)
    const user = await this.prisma.user.create({
      data: {
        ...userData,
        roleId: finalRoleId,
      } as Prisma.UserUncheckedCreateInput,
      include: {
        role: true,
      },
    });

    // Fetch user again with role relation
    return this.prisma.user.findUnique({
      where: { userId: user.userId },
      include: {
        role: true,
      },
    }) as Promise<User>;
  }

  async findAll(params?: ListUserRequest): Promise<{ rows: User[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchKey,
      searchTerm,
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

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

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'username') {
      orderBy.username = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'email') {
      orderBy.email = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          role: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { rows, count };
  }

  async findById(id: number): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: {
        userId: id,
      },
      include: {
        role: true,
      },
    });
    return user as User | null;
  }

  async update(id: number, data: UpdateUserRequest): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: {
        userId: id,
      },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const { roleId, ...updateFields } = data;
    const userUpdateData: Record<string, unknown> = {};
    if (updateFields.email !== undefined) userUpdateData.email = updateFields.email;
    if (updateFields.password !== undefined) userUpdateData.password = updateFields.password;
    if (updateFields.isActive !== undefined) userUpdateData.isActive = updateFields.isActive;
    if (updateFields.updatedById !== undefined)
      userUpdateData.updatedById = updateFields.updatedById;

    // Always use roleId for updates (ignore role name for updates)
    // Update roleId if provided (1-to-1 relationship)
    if (roleId !== undefined) {
      userUpdateData.roleId = roleId;
    }

    // Actually update the user record in database
    if (Object.keys(userUpdateData).length > 0) {
      await this.prisma.user.update({
        where: { userId: id },
        data: userUpdateData,
      });
    }

    // Fetch user again with role relation
    return this.prisma.user.findUnique({
      where: { userId: id },
      include: {
        role: true,
      },
    }) as Promise<User>;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.user.delete({
      where: { userId: id },
    });
  }
}
