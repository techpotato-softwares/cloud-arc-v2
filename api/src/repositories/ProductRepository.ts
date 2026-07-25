import { injectable, inject } from 'inversify';
import { PrismaClient, Product, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateProductRequest,
  UpdateProductRequest,
  ListProductRequest,
} from '../schemas/request/ProductRequest';
import { ProductResponse } from 'src/schemas/response/ProductResponse';

// Allowed searchable fields for Product model
const ALLOWED_SEARCH_FIELDS = ['productName'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'productName';

export interface IProductRepository {
  findAll(params?: ListProductRequest): Promise<{ rows: ProductResponse[]; count: number }>;
  findById(id: number): Promise<ProductResponse | null>;
  create(data: CreateProductRequest): Promise<ProductResponse | null>;
  update(id: number, data: UpdateProductRequest): Promise<Product>;
  delete(id: number): Promise<void>;
}

@injectable()
export class ProductRepository implements IProductRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(params?: ListProductRequest): Promise<{ rows: ProductResponse[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      isActive,
      categoryId,
      oemId,
      searchKey,
      searchTerm,
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (categoryId) {
      where.categoryId = typeof categoryId === 'string' ? parseInt(categoryId, 10) : categoryId;
    }

    if (oemId) {
      where.oemId = typeof oemId === 'string' ? parseInt(oemId, 10) : oemId;
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

    const orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'productName') {
      orderBy.productName = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          category: true,
          oem: true,
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      rows: rows.map(
        (product): ProductResponse => ({
          productId: product.productId,
          productName: product.productName,
          category: {
            categoryId: product.category.categoryId,
            categoryName: product.category.categoryName,
          },
          oem: {
            oemId: product.oem.oemId,
            oemName: product.oem.oemName,
          },
          isActive: product.isActive ?? true,
          createdById: product.createdById,
          updatedById: product.updatedById,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        })
      ),
      count,
    };
  }

  async findById(id: number): Promise<ProductResponse | null> {
    const product = await this.prisma.product.findUnique({
      where: { productId: id },
      include: {
        category: true,
        oem: true,
      },
    });
    if (!product) return null;
    return {
      productId: product.productId,
      productName: product.productName,
      category: {
        categoryId: product.category.categoryId,
        categoryName: product.category.categoryName,
      },
      oem: {
        oemId: product.oem.oemId,
        oemName: product.oem.oemName,
      },
      isActive: product.isActive ?? true,
      createdById: product.createdById,
      updatedById: product.updatedById,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  async create(data: CreateProductRequest): Promise<ProductResponse | null> {
    const categoryId =
      typeof data.categoryId === 'string' ? parseInt(data.categoryId, 10) : data.categoryId;
    const oemId = typeof data.oemId === 'string' ? parseInt(data.oemId, 10) : data.oemId;

    // Use UncheckedCreateInput to allow setting foreign keys directly
    const product = await this.prisma.product.create({
      data: {
        productName: data.productName,
        categoryId: categoryId,
        oemId: oemId,
        isActive: data.isActive ?? true,
        createdById: data.createdById ?? null,
        updatedById: data.updatedById ?? null,
      } as Prisma.ProductUncheckedCreateInput,
    });

    return await this.findById(product.productId);
  }

  async update(id: number, data: UpdateProductRequest): Promise<Product> {
    const categoryId =
      typeof data.categoryId === 'string' ? parseInt(data.categoryId, 10) : data.categoryId;
    const oemId = typeof data.oemId === 'string' ? parseInt(data.oemId, 10) : data.oemId;

    const updateData: Prisma.ProductUpdateInput = {
      productName: data.productName,
      isActive: data.isActive,
      updatedBy: { connect: { userId: data.updatedById } },
    };

    if (categoryId !== undefined) {
      updateData.category = { connect: { categoryId } };
    }
    if (oemId !== undefined) {
      updateData.oem = { connect: { oemId } };
    }

    const product = await this.prisma.product.update({
      where: { productId: id },
      data: updateData,
    });
    return product;
  }

  async delete(id: number): Promise<void> {
    await this.prisma.product.delete({ where: { productId: id } });
  }
}
