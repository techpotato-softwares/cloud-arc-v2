import { injectable, inject } from 'inversify';
import { PrismaClient, Category, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ListCategoryRequest,
} from '../schemas/request/CategoryRequest';
import { CategoryResponse } from 'src/schemas/response/CategoryResponse';

// Allowed searchable fields for Category model
const ALLOWED_SEARCH_FIELDS = ['categoryName'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'categoryName';

export interface ICategoryRepository {
  findAll(params?: ListCategoryRequest): Promise<{ rows: CategoryResponse[]; count: number }>;
  findById(id: number): Promise<Category | null>;
  create(data: CreateCategoryRequest): Promise<Category>;
  update(id: number, data: UpdateCategoryRequest): Promise<Category>;
  delete(id: number): Promise<void>;
}

@injectable()
export class CategoryRepository implements ICategoryRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(
    params?: ListCategoryRequest
  ): Promise<{ rows: CategoryResponse[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      isActive,
      searchKey,
      searchTerm,
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

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

    const orderBy: Prisma.CategoryOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'categoryName') {
      orderBy.categoryName = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      rows: rows.map((category) => ({
        categoryId: category.categoryId,
        categoryName: category.categoryName,
        isActive: category.isActive,
        createdById: category.createdById,
        updatedById: category.updatedById,
      })),
      count,
    };
  }

  async findById(id: number): Promise<Category | null> {
    return this.prisma.category.findUnique({ where: { categoryId: id } });
  }

  async create(data: CreateCategoryRequest): Promise<Category> {
    return this.prisma.category.create({
      data: {
        categoryName: data.categoryName,
        isActive: data.isActive ?? true,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
  }

  async update(id: number, data: UpdateCategoryRequest): Promise<Category> {
    return this.prisma.category.update({
      where: { categoryId: id },
      data: {
        categoryName: data.categoryName,
        isActive: data.isActive,
        updatedById: data.updatedById,
      },
    });
  }

  async delete(id: number): Promise<void> {
    await this.prisma.category.delete({ where: { categoryId: id } });
  }
}
