import { injectable, inject } from 'inversify';
import { PrismaClient, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import { CreateOEMRequest, UpdateOEMRequest, ListOEMRequest } from '../schemas/request/OEMRequest';
import { OEMResponse } from '../schemas/response/OEMResponse';

// Allowed searchable fields for OEM model
const ALLOWED_SEARCH_FIELDS = ['oemName'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'oemName';

export interface IOEMRepository {
  findAll(params?: ListOEMRequest): Promise<{ rows: OEMResponse[]; count: number }>;
  findById(id: number): Promise<OEMResponse | null>;
  create(data: CreateOEMRequest): Promise<OEMResponse>;
  update(id: number, data: UpdateOEMRequest): Promise<OEMResponse>;
  delete(id: number): Promise<void>;
}

@injectable()
export class OEMRepository implements IOEMRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(params?: ListOEMRequest): Promise<{ rows: OEMResponse[]; count: number }> {
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

    const where: Prisma.OEMWhereInput = {};

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

    const orderBy: Prisma.OEMOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'oemName' || sortBy === 'name') {
      orderBy.oemName = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.oEM.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      this.prisma.oEM.count({ where }),
    ]);

    return {
      rows: rows.map((oem) => ({
        oemId: oem.oemId,
        name: oem.oemName,
        isActive: oem.isActive,
        createdAt: oem.createdAt,
        updatedAt: oem.updatedAt,
        createdById: oem.createdById,
        updatedById: oem.updatedById,
      })),
      count,
    };
  }

  async findById(id: number): Promise<OEMResponse | null> {
    const oem = await this.prisma.oEM.findUnique({ where: { oemId: id } });
    if (!oem) return null;
    return {
      oemId: oem.oemId,
      name: oem.oemName,
      isActive: oem.isActive ?? true,
      createdById: oem.createdById,
      updatedById: oem.updatedById,
      createdAt: oem.createdAt,
      updatedAt: oem.updatedAt,
    };
  }

  async create(data: CreateOEMRequest): Promise<OEMResponse> {
    const oem = await this.prisma.oEM.create({
      data: {
        oemName: data.name,
        isActive: data.isActive ?? true,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
    return {
      oemId: oem.oemId,
      name: oem.oemName,
      isActive: oem.isActive ?? true,
      createdById: oem.createdById,
      updatedById: oem.updatedById,
      createdAt: oem.createdAt,
      updatedAt: oem.updatedAt,
    };
  }

  async update(id: number, data: UpdateOEMRequest): Promise<OEMResponse> {
    const updateData: Prisma.OEMUpdateInput = {};

    if (data.name !== undefined) {
      updateData.oemName = data.name;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }

    if (data.updatedById !== undefined) {
      updateData.updatedById = data.updatedById;
    }

    const oem = await this.prisma.oEM.update({
      where: { oemId: id },
      data: updateData,
    });
    return {
      oemId: oem.oemId,
      name: oem.oemName,
      isActive: oem.isActive,
      createdById: oem.createdById,
      updatedById: oem.updatedById,
      createdAt: oem.createdAt,
      updatedAt: oem.updatedAt,
    };
  }

  async delete(id: number): Promise<void> {
    await this.prisma.oEM.delete({ where: { oemId: id } });
  }
}
