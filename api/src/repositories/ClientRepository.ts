import { injectable, inject } from 'inversify';
import { PrismaClient, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateClientRequest,
  UpdateClientRequest,
  ListClientRequest,
} from '../schemas/request/ClientRequest';
import { ClientResponse } from 'src/schemas/response/ClientResponse';

// Allowed searchable fields for Client model
const ALLOWED_SEARCH_FIELDS = ['clientName'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'clientName';

export interface IClientRepository {
  findAll(params?: ListClientRequest): Promise<{ rows: ClientResponse[]; count: number }>;
  findById(id: number): Promise<ClientResponse | null>;
  create(data: CreateClientRequest): Promise<ClientResponse>;
  update(id: number, data: UpdateClientRequest): Promise<ClientResponse>;
  delete(id: number): Promise<void>;
}

@injectable()
export class ClientRepository implements IClientRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(params?: ListClientRequest): Promise<{ rows: ClientResponse[]; count: number }> {
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

    const where: Prisma.ClientWhereInput = {};

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

    const orderBy: Prisma.ClientOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'clientName') {
      orderBy.clientName = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'updatedAt') {
      orderBy.updatedAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      rows: rows.map((client) => ({
        clientId: client.clientId,
        clientName: client.clientName,
        clientAddress: client.clientAddress ?? null,
        clientContact: client.clientContact ?? null,
        clientGST: client.clientGST ?? null,
        isActive: client.isActive,
        createdById: client.createdById,
        updatedById: client.updatedById,
      })),
      count,
    };
  }

  async findById(id: number): Promise<ClientResponse | null> {
    const client = await this.prisma.client.findUnique({ where: { clientId: id } });
    if (!client) return null;
    return {
      clientId: client.clientId,
      clientName: client.clientName,
      clientAddress: client.clientAddress ?? null,
      clientContact: client.clientContact ?? null,
      clientGST: client.clientGST ?? null,
      isActive: client.isActive,
      createdById: client.createdById,
      updatedById: client.updatedById,
    };
  }

  async create(data: CreateClientRequest): Promise<ClientResponse> {
    const client = await this.prisma.client.create({
      data: {
        clientName: data.clientName,
        clientAddress: data.clientAddress ?? null,
        clientContact: data.clientContact ?? null,
        clientGST: data.clientGST ?? null,
        isActive: data.isActive ?? true,
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
    });
    return {
      clientId: client.clientId,
      clientName: client.clientName,
      clientAddress: client.clientAddress ?? null,
      clientContact: client.clientContact ?? null,
      clientGST: client.clientGST ?? null,
      isActive: client.isActive,
      createdById: client.createdById,
      updatedById: client.updatedById,
    };
  }

  async update(id: number, data: UpdateClientRequest): Promise<ClientResponse> {
    const client = await this.prisma.client.update({
      where: { clientId: id },
      data: {
        clientName: data.clientName,
        clientAddress: data.clientAddress !== undefined ? data.clientAddress : undefined,
        clientContact: data.clientContact !== undefined ? data.clientContact : undefined,
        clientGST: data.clientGST !== undefined ? data.clientGST : undefined,
        isActive: data.isActive ?? undefined,
        updatedById: data.updatedById,
      },
    });
    return {
      clientId: client.clientId,
      clientName: client.clientName,
      clientAddress: client.clientAddress ?? null,
      clientContact: client.clientContact ?? null,
      clientGST: client.clientGST ?? null,
      isActive: client.isActive,
      createdById: client.createdById,
      updatedById: client.updatedById,
    };
  }

  async delete(id: number): Promise<void> {
    await this.prisma.client.delete({ where: { clientId: id } });
  }
}
