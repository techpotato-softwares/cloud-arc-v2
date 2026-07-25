/**
 * Service Repository
 *
 * Data access layer for service operations using Prisma ORM.
 * Service includes: Pre-Commissioning (Section 1), Commissioning (Section 2), Warranty Certificate (Section 3)
 */

import { injectable, inject } from 'inversify';
import { PrismaClient, Service, Prisma, User } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateServiceRequest,
  UpdateServiceRequest,
  UpdateCommissioningRequest,
  UpdateWarrantyRequest,
  ListServiceRequest,
} from '../schemas';

// Type for Service with included relations
export type ServiceWithRelations = Service & {
  dispatch?: {
    dispatchId: number;
    poId: string;
  };
  createdBy: User | null;
  updatedBy: User | null;
  assignedServiceEngineer: User | null;
};

export interface IServiceRepository {
  create(data: CreateServiceRequest): Promise<ServiceWithRelations>;
  findById(serviceId: number): Promise<ServiceWithRelations | null>;
  findAll(params: ListServiceRequest): Promise<{ rows: ServiceWithRelations[]; count: number }>;
  findByDispatchId(dispatchId: number): Promise<ServiceWithRelations[]>;
  findByPoId(poId: string): Promise<ServiceWithRelations[]>;
  updateService(
    serviceId: number,
    data: UpdateServiceRequest
  ): Promise<ServiceWithRelations | null>;
  updateCommissioning(
    serviceId: number,
    data: UpdateCommissioningRequest
  ): Promise<ServiceWithRelations | null>;
  updateWarranty(
    serviceId: number,
    data: UpdateWarrantyRequest
  ): Promise<ServiceWithRelations | null>;
  delete(serviceId: number): Promise<boolean>;
}

@injectable()
export class ServiceRepository implements IServiceRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  // Include clause for fetching all relations
  private readonly includeRelations = {
    dispatch: {
      select: {
        dispatchId: true,
        poId: true,
      },
    },
    createdBy: true,
    updatedBy: true,
    assignedServiceEngineer: true,
  };

  /**
   * Create a new service (Section 1: Pre-Commissioning)
   */
  async create(data: CreateServiceRequest): Promise<ServiceWithRelations> {
    const service = await this.prisma.service.create({
      data: {
        dispatchId: data.dispatchId,
        serialNumber: data.serialNumber,
        productName: data.productName,
        pcContact: data.pcContact,
        assignedServiceEngineerId: data.assignedServiceEngineerId,
        ppmChecklist: data.ppmChecklist,
        ppmSheetReceivedFromClient: data.ppmSheetReceivedFromClient,
        ppmChecklistSharedWithOem: data.ppmChecklistSharedWithOem,
        ppmTickedNoFromOem: data.ppmTickedNoFromOem,
        ppmConfirmationStatus: data.ppmConfirmationStatus,
        oemComments: data.oemComments,
        preCommissioningStatus: data.preCommissioningStatus,
        remarks: data.remarks,
        warranty: data.warranty,
        preCommissioningUpdatedAt: new Date(),
        createdById: data.createdById,
        updatedById: data.updatedById,
      },
      include: this.includeRelations,
    });

    return service as ServiceWithRelations;
  }

  /**
   * Find a service by ID
   */
  async findById(serviceId: number): Promise<ServiceWithRelations | null> {
    const service = await this.prisma.service.findUnique({
      where: { serviceId },
      include: this.includeRelations,
    });
    return service as ServiceWithRelations | null;
  }

  /**
   * Find all services with pagination and filtering
   */
  async findAll(
    params: ListServiceRequest
  ): Promise<{ rows: ServiceWithRelations[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      dispatchId,
      poId,
      preCommissioningStatus,
      commissioningStatus,
      warrantyStatus,
      serialNumber,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ServiceWhereInput = {};
    if (dispatchId) {
      where.dispatchId = dispatchId;
    }
    if (poId) {
      where.dispatch = { poId };
    }
    if (preCommissioningStatus) {
      where.preCommissioningStatus = preCommissioningStatus;
    }
    if (commissioningStatus) {
      where.commissioningStatus = commissioningStatus;
    }
    if (warrantyStatus) {
      where.warrantyStatus = warrantyStatus;
    }
    if (serialNumber) {
      where.serialNumber = { contains: serialNumber, mode: 'insensitive' };
    }

    // Build orderBy
    const orderByField = sortBy as keyof Prisma.ServiceOrderByWithRelationInput;
    const orderBy: Prisma.ServiceOrderByWithRelationInput = {
      [orderByField]: sortOrder.toLowerCase() as Prisma.SortOrder,
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.service.findMany({
        where,
        include: this.includeRelations,
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.service.count({ where }),
    ]);

    return { rows: rows as ServiceWithRelations[], count };
  }

  /**
   * Find all services for a specific dispatch
   */
  async findByDispatchId(dispatchId: number): Promise<ServiceWithRelations[]> {
    const services = await this.prisma.service.findMany({
      where: { dispatchId },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    return services as ServiceWithRelations[];
  }

  /**
   * Find all services for a specific PO (via dispatch)
   */
  async findByPoId(poId: string): Promise<ServiceWithRelations[]> {
    const services = await this.prisma.service.findMany({
      where: {
        dispatch: {
          poId,
        },
      },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    return services as ServiceWithRelations[];
  }

  /**
   * Update service (Section 1: Pre-Commissioning)
   */
  async updateService(
    serviceId: number,
    data: UpdateServiceRequest
  ): Promise<ServiceWithRelations | null> {
    // Check if service exists
    const existing = await this.prisma.service.findUnique({ where: { serviceId } });
    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.ServiceUncheckedUpdateInput = {
      preCommissioningUpdatedAt: new Date(),
    };
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.serialNumber !== undefined) updateData.serialNumber = data.serialNumber;
    if (data.productName !== undefined) updateData.productName = data.productName;
    if (data.pcContact !== undefined) updateData.pcContact = data.pcContact;
    if (data.assignedServiceEngineerId !== undefined)
      updateData.assignedServiceEngineerId = data.assignedServiceEngineerId;
    if (data.ppmChecklist !== undefined) updateData.ppmChecklist = data.ppmChecklist;
    if (data.ppmSheetReceivedFromClient !== undefined)
      updateData.ppmSheetReceivedFromClient = data.ppmSheetReceivedFromClient;
    if (data.ppmChecklistSharedWithOem !== undefined)
      updateData.ppmChecklistSharedWithOem = data.ppmChecklistSharedWithOem;
    if (data.ppmTickedNoFromOem !== undefined)
      updateData.ppmTickedNoFromOem = data.ppmTickedNoFromOem;
    if (data.ppmConfirmationStatus !== undefined)
      updateData.ppmConfirmationStatus = data.ppmConfirmationStatus;
    if (data.oemComments !== undefined) updateData.oemComments = data.oemComments;
    if (data.preCommissioningStatus !== undefined)
      updateData.preCommissioningStatus = data.preCommissioningStatus;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;
    if (data.warranty !== undefined) updateData.warranty = data.warranty;

    await this.prisma.service.update({
      where: { serviceId },
      data: updateData,
    });

    return this.findById(serviceId);
  }

  /**
   * Update commissioning (Section 2)
   */
  async updateCommissioning(
    serviceId: number,
    data: UpdateCommissioningRequest
  ): Promise<ServiceWithRelations | null> {
    // Check if service exists
    const existing = await this.prisma.service.findUnique({ where: { serviceId } });
    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.ServiceUncheckedUpdateInput = {
      commissioningUpdatedAt: new Date(),
    };
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.commissioningEcdFromClient !== undefined)
      updateData.commissioningEcdFromClient = data.commissioningEcdFromClient;
    if (data.commissioningServiceTicketNo !== undefined)
      updateData.commissioningServiceTicketNo = data.commissioningServiceTicketNo;
    if (data.commissioningIssues !== undefined)
      updateData.commissioningIssues = data.commissioningIssues;
    if (data.commissioningSolution !== undefined)
      updateData.commissioningSolution = data.commissioningSolution;
    if (data.commissioningDate !== undefined) {
      updateData.commissioningDate = new Date(data.commissioningDate);
    }
    if (data.commissioningStatus !== undefined)
      updateData.commissioningStatus = data.commissioningStatus;
    if (data.commissioningRemarks !== undefined)
      updateData.commissioningRemarks = data.commissioningRemarks;

    await this.prisma.service.update({
      where: { serviceId },
      data: updateData,
    });

    return this.findById(serviceId);
  }

  /**
   * Update warranty certificate (Section 3)
   */
  async updateWarranty(
    serviceId: number,
    data: UpdateWarrantyRequest
  ): Promise<ServiceWithRelations | null> {
    // Check if service exists
    const existing = await this.prisma.service.findUnique({ where: { serviceId } });
    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.ServiceUncheckedUpdateInput = {
      warrantyUpdatedAt: new Date(),
    };
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.warrantyCertificateNo !== undefined)
      updateData.warrantyCertificateNo = data.warrantyCertificateNo;
    if (data.warrantyIssueDate !== undefined) {
      updateData.warrantyIssueDate = new Date(data.warrantyIssueDate);
    }
    if (data.warrantyStartDate !== undefined) {
      updateData.warrantyStartDate = new Date(data.warrantyStartDate);
    }
    if (data.warrantyEndDate !== undefined) {
      updateData.warrantyEndDate = new Date(data.warrantyEndDate);
    }
    if (data.warrantyStatus !== undefined) updateData.warrantyStatus = data.warrantyStatus;

    await this.prisma.service.update({
      where: { serviceId },
      data: updateData,
    });

    return this.findById(serviceId);
  }

  /**
   * Delete a service
   */
  async delete(serviceId: number): Promise<boolean> {
    try {
      await this.prisma.service.delete({ where: { serviceId } });
      return true;
    } catch {
      return false;
    }
  }
}
