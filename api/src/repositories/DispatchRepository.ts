/**
 * Dispatch Repository
 *
 * Data access layer for dispatch operations using Prisma ORM.
 */

import { injectable, inject } from 'inversify';
import { PrismaClient, Dispatch, DispatchedItem, Prisma, Product, User } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
  DispatchedItemRequest,
} from '../schemas';

// Type for DispatchedItem with included relations
export type DispatchedItemWithRelations = DispatchedItem & {
  product: Product;
};

// Type for Dispatch with included relations
export type DispatchWithRelations = Dispatch & {
  dispatchedItems: DispatchedItemWithRelations[];
  createdBy: User | null;
  updatedBy: User | null;
};

export interface IDispatchRepository {
  create(data: CreateDispatchRequest): Promise<DispatchWithRelations>;
  findById(dispatchId: number): Promise<DispatchWithRelations | null>;
  findAll(params: ListDispatchRequest): Promise<{ rows: DispatchWithRelations[]; count: number }>;
  findByPoId(poId: string): Promise<DispatchWithRelations[]>;
  getPOTotalQuantity(poId: string): Promise<number>;
  updateDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchWithRelations | null>;
  updateDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchWithRelations | null>;
  updateDelivery(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchWithRelations | null>;
  delete(dispatchId: number): Promise<boolean>;
}

@injectable()
export class DispatchRepository implements IDispatchRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  // Include clause for fetching all relations
  private readonly includeRelations = {
    dispatchedItems: {
      include: {
        product: true,
      },
    },
    createdBy: true,
    updatedBy: true,
  };

  /**
   * Create a new dispatch with dispatched items
   */
  async create(data: CreateDispatchRequest): Promise<DispatchWithRelations> {
    const dispatch = await this.prisma.dispatch.create({
      data: {
        poId: data.poId,
        projectName: data.projectName,
        projectLocation: data.projectLocation,
        deliveryLocation: data.deliveryLocation,
        deliveryAddress: data.deliveryAddress,
        googleMapLink: data.googleMapLink,
        confirmDispatchDate: new Date(data.confirmDispatchDate),
        deliveryContact: data.deliveryContact,
        remarks: data.remarks,
        createdById: data.createdById,
        updatedById: data.updatedById,
        dispatchedItems: {
          create: data.dispatchedItems.map((item: DispatchedItemRequest) => ({
            productId: item.productId,
            poItemId: item.poItemId,
            quantity: item.quantity,
            warranty: item.warranty,
            serialNumbers: item.serialNumbers,
          })),
        },
      },
      include: this.includeRelations,
    });

    return dispatch as DispatchWithRelations;
  }

  /**
   * Find a dispatch by ID
   */
  async findById(dispatchId: number): Promise<DispatchWithRelations | null> {
    const dispatch = await this.prisma.dispatch.findUnique({
      where: { dispatchId },
      include: this.includeRelations,
    });
    return dispatch as DispatchWithRelations | null;
  }

  /**
   * Find all dispatches with pagination and filtering
   */
  async findAll(
    params: ListDispatchRequest
  ): Promise<{ rows: DispatchWithRelations[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      poId,
      dispatchStatus,
      deliveryStatus,
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.DispatchWhereInput = {};
    if (poId) {
      where.poId = poId;
    }
    if (dispatchStatus) {
      where.dispatchStatus = dispatchStatus;
    }
    if (deliveryStatus) {
      where.deliveryStatus = deliveryStatus;
    }

    // Build orderBy
    const orderByField = sortBy as keyof Prisma.DispatchOrderByWithRelationInput;
    const orderBy: Prisma.DispatchOrderByWithRelationInput = {
      [orderByField]: sortOrder.toLowerCase() as Prisma.SortOrder,
    };

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.dispatch.findMany({
        where,
        include: this.includeRelations,
        orderBy,
        take: limit,
        skip,
      }),
      this.prisma.dispatch.count({ where }),
    ]);

    return { rows: rows as DispatchWithRelations[], count };
  }

  /**
   * Find all dispatches for a specific PO
   */
  async findByPoId(poId: string): Promise<DispatchWithRelations[]> {
    const dispatches = await this.prisma.dispatch.findMany({
      where: { poId },
      include: this.includeRelations,
      orderBy: { createdAt: 'desc' },
    });
    return dispatches as DispatchWithRelations[];
  }

  /**
   * Get total quantity from PO items for a specific PO
   */
  async getPOTotalQuantity(poId: string): Promise<number> {
    const result = await this.prisma.pOItem.aggregate({
      where: { poId },
      _sum: { quantity: true },
    });
    return result._sum.quantity || 0;
  }

  /**
   * Update dispatch details (Section 1)
   */
  async updateDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchWithRelations | null> {
    // Check if dispatch exists
    const existing = await this.prisma.dispatch.findUnique({ where: { dispatchId } });
    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.DispatchUncheckedUpdateInput = {};
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.projectName !== undefined) updateData.projectName = data.projectName;
    if (data.projectLocation !== undefined) updateData.projectLocation = data.projectLocation;
    if (data.deliveryLocation !== undefined) updateData.deliveryLocation = data.deliveryLocation;
    if (data.deliveryAddress !== undefined) updateData.deliveryAddress = data.deliveryAddress;
    if (data.googleMapLink !== undefined) updateData.googleMapLink = data.googleMapLink;
    if (data.confirmDispatchDate !== undefined) {
      updateData.confirmDispatchDate = new Date(data.confirmDispatchDate);
    }
    if (data.deliveryContact !== undefined) updateData.deliveryContact = data.deliveryContact;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;

    // If dispatchedItems provided, delete existing and create new ones
    if (data.dispatchedItems) {
      await this.prisma.$transaction([
        this.prisma.dispatchedItem.deleteMany({ where: { dispatchId } }),
        this.prisma.dispatch.update({
          where: { dispatchId },
          data: {
            ...updateData,
            dispatchedItems: {
              create: data.dispatchedItems.map((item: DispatchedItemRequest) => ({
                productId: item.productId,
                poItemId: item.poItemId,
                quantity: item.quantity,
                warranty: item.warranty,
                serialNumbers: item.serialNumbers,
              })),
            },
          },
        }),
      ]);
    } else {
      await this.prisma.dispatch.update({
        where: { dispatchId },
        data: updateData,
      });
    }

    return this.findById(dispatchId);
  }

  /**
   * Update dispatch documents (Section 2)
   */
  async updateDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchWithRelations | null> {
    // Check if dispatch exists
    const existing = await this.prisma.dispatch.findUnique({
      where: { dispatchId },
      include: { dispatchedItems: true },
    });
    if (!existing) {
      return null;
    }

    // Build update data for dispatch
    const updateData: Prisma.DispatchUncheckedUpdateInput = {
      documentUpdatedAt: new Date(),
    };
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.noDuesClearance !== undefined) updateData.noDuesClearance = data.noDuesClearance;
    if (data.docOsgPiNo !== undefined) updateData.docOsgPiNo = data.docOsgPiNo;
    if (data.docOsgPiDate !== undefined) updateData.docOsgPiDate = new Date(data.docOsgPiDate);
    if (data.taxInvoiceNumber !== undefined) updateData.taxInvoiceNumber = data.taxInvoiceNumber;
    if (data.invoiceDate !== undefined) updateData.invoiceDate = new Date(data.invoiceDate);
    if (data.ewayBill !== undefined) updateData.ewayBill = data.ewayBill;
    if (data.deliveryChallan !== undefined) updateData.deliveryChallan = data.deliveryChallan;
    if (data.dispatchDate !== undefined) updateData.dispatchDate = new Date(data.dispatchDate);
    if (data.packagingList !== undefined) updateData.packagingList = data.packagingList;
    if (data.deliveryPincode !== undefined) {
      updateData.deliveryPincode = data.deliveryPincode;
    }
    if (data.dispatchStatus !== undefined) updateData.dispatchStatus = data.dispatchStatus;
    if (data.dispatchLrNo !== undefined) updateData.dispatchLrNo = data.dispatchLrNo;
    if (data.dispatchRemarks !== undefined) updateData.dispatchRemarks = data.dispatchRemarks;

    // Update dispatch
    await this.prisma.dispatch.update({
      where: { dispatchId },
      data: updateData,
    });

    // Update serial numbers for dispatched items if provided
    if (data.serialNumbers) {
      for (const item of existing.dispatchedItems) {
        const serialNumber = data.serialNumbers[item.productId];
        if (serialNumber !== undefined) {
          await this.prisma.dispatchedItem.update({
            where: { id: item.id },
            data: { serialNumbers: serialNumber },
          });
        }
      }
    }

    return this.findById(dispatchId);
  }

  /**
   * Update delivery confirmation (Section 3)
   */
  async updateDelivery(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchWithRelations | null> {
    // Check if dispatch exists
    const existing = await this.prisma.dispatch.findUnique({ where: { dispatchId } });
    if (!existing) {
      return null;
    }

    // Build update data
    const updateData: Prisma.DispatchUncheckedUpdateInput = {
      deliveryUpdatedAt: new Date(),
    };
    if (data.updatedById !== undefined) updateData.updatedById = data.updatedById;
    if (data.dateOfDelivery !== undefined) {
      updateData.dateOfDelivery = new Date(data.dateOfDelivery);
    }
    if (data.deliveryStatus !== undefined) updateData.deliveryStatus = data.deliveryStatus;
    if (data.proofOfDelivery !== undefined) updateData.proofOfDelivery = data.proofOfDelivery;

    await this.prisma.dispatch.update({
      where: { dispatchId },
      data: updateData,
    });

    return this.findById(dispatchId);
  }

  /**
   * Delete a dispatch
   */
  async delete(dispatchId: number): Promise<boolean> {
    try {
      await this.prisma.dispatch.delete({ where: { dispatchId } });
      return true;
    } catch {
      return false;
    }
  }
}
