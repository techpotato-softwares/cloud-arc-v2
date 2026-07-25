import { injectable, inject } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { TYPES } from '../types/types';
import {
  IPORepository,
  PurchaseOrderWithRelations,
  POItemWithRelations,
} from '../repositories/PORepository';
import {
  CreatePORequest,
  UpdatePORequest,
  ListPORequest,
  POResponse,
  POListResponse,
  POItemResponse,
  POAccordionStatus,
  AccordionStatusType,
} from '../schemas';

export interface IPOService {
  createPO(data: CreatePORequest): Promise<POResponse>;
  getPOById(poId: string): Promise<POResponse | null>;
  getAllPOs(params: ListPORequest): Promise<POListResponse>;
  updatePO(poId: string, data: UpdatePORequest): Promise<POResponse | null>;
  deletePO(poId: string): Promise<boolean>;
  /** Used by SummaryService to get accordion status for a PO without full response */
  getAccordionStatus(poId: string, totalPOQty: number): Promise<POAccordionStatus>;
  /** Build POResponse from PO entity and optional accordion (for SummaryService) */
  buildResponseFromPO(
    po: PurchaseOrderWithRelations,
    accordionStatus?: POAccordionStatus
  ): POResponse;
}

@injectable()
export class POService implements IPOService {
  constructor(
    @inject(TYPES.PORepository) private poRepository: IPORepository,
    @inject(TYPES.PrismaClient) private prisma: PrismaClient
  ) {}

  private mapItemToResponse(item: POItemWithRelations): POItemResponse {
    return {
      id: item.id,
      categoryId: item.categoryId,
      categoryName: item.category?.categoryName,
      oemId: item.oemId,
      oemName: item.oem?.oemName,
      productId: item.productId,
      productName: item.product?.productName,
      quantity: item.quantity,
      spareQuantity: item.spareQuantity,
      totalQuantity: item.totalQuantity,
      pricePerUnit: Number(item.pricePerUnit),
      totalPrice: Number(item.totalPrice),
      gstPercent: Number(item.gstPercent),
      finalPrice: Number(item.finalPrice),
      warranty: item.warranty,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  /**
   * Calculate accordion status for all sections of a PO
   */
  private async calculateAccordionStatus(
    poId: string,
    totalPOQty: number
  ): Promise<POAccordionStatus> {
    // Get all dispatches for this PO
    const dispatches = await this.prisma.dispatch.findMany({
      where: { poId },
      include: {
        dispatchedItems: true,
      },
    });

    // Calculate dispatched quantity
    const dispatchedQty = dispatches.reduce((sum, d) => {
      return sum + d.dispatchedItems.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Dispatch Status
    let dispatchStatus: AccordionStatusType = 'Not Started';
    if (dispatches.length > 0) {
      dispatchStatus = dispatchedQty >= totalPOQty ? 'Done' : 'In-Progress';
    }

    // Document Status
    const dispatchesWithDocuments = dispatches.filter((d) => !!d.dispatchStatus).length;
    const dispatchesWithDoneDocuments = dispatches.filter(
      (d) => d.dispatchStatus === 'done'
    ).length;
    let documentStatus: AccordionStatusType = 'Not Started';
    if (dispatchesWithDocuments > 0) {
      documentStatus =
        dispatchStatus === 'Done' && dispatchesWithDoneDocuments >= dispatches.length
          ? 'Done'
          : 'In-Progress';
    }

    // Delivery Status
    const dispatchesForDelivery = dispatches.filter((d) => d.dispatchStatus === 'done').length;
    const dispatchesWithDelivery = dispatches.filter((d) => !!d.deliveryStatus).length;
    const dispatchesWithDeliveryDone = dispatches.filter((d) => d.deliveryStatus === 'done').length;
    let deliveryStatus: AccordionStatusType = 'Not Started';
    if (dispatchesForDelivery > 0 && dispatchesWithDelivery > 0) {
      deliveryStatus = dispatchesWithDeliveryDone >= dispatchesForDelivery ? 'Done' : 'In-Progress';
    }

    // Pre-Commissioning Status (eligible = delivery done)
    const eligibleForPreCommissioning = dispatchesWithDeliveryDone;
    const preCommissioningCount = await this.prisma.service.count({
      where: { dispatch: { poId } },
    });
    const preCommissioningDoneCount = await this.prisma.service.count({
      where: { dispatch: { poId }, preCommissioningStatus: 'done' },
    });
    let preCommissioningStatus: AccordionStatusType = 'Not Started';
    if (preCommissioningCount > 0) {
      preCommissioningStatus =
        preCommissioningDoneCount >= eligibleForPreCommissioning && eligibleForPreCommissioning > 0
          ? 'Done'
          : 'In-Progress';
    }

    // Commissioning Status (eligible = pre-commissioning done)
    // Now using unified Service model - commissioningStatus field
    const commissioningCount = await this.prisma.service.count({
      where: { dispatch: { poId }, commissioningStatus: { not: null } },
    });
    const commissioningDoneCount = await this.prisma.service.count({
      where: { dispatch: { poId }, commissioningStatus: 'done' },
    });
    let commissioningStatus: AccordionStatusType = 'Not Started';
    if (commissioningCount > 0) {
      commissioningStatus =
        commissioningDoneCount >= preCommissioningDoneCount && preCommissioningDoneCount > 0
          ? 'Done'
          : 'In-Progress';
    }

    // Warranty Status (eligible = commissioning done)
    // Now using unified Service model - warrantyStatus field
    const warrantyCount = await this.prisma.service.count({
      where: { dispatch: { poId }, warrantyStatus: { not: null } },
    });
    const warrantyDoneCount = await this.prisma.service.count({
      where: { dispatch: { poId }, warrantyStatus: 'done' },
    });
    let warrantyStatus: AccordionStatusType = 'Not Started';
    if (warrantyCount > 0) {
      warrantyStatus =
        warrantyDoneCount >= commissioningDoneCount && commissioningDoneCount > 0
          ? 'Done'
          : 'In-Progress';
    }

    return {
      dispatch: {
        status: dispatchStatus,
        totalQty: totalPOQty,
        dispatchedQty,
      },
      document: {
        status: documentStatus,
        total: dispatches.length,
        completed: dispatchesWithDoneDocuments,
      },
      delivery: {
        status: deliveryStatus,
        total: dispatchesForDelivery,
        completed: dispatchesWithDeliveryDone,
      },
      preCommissioning: {
        status: preCommissioningStatus,
        total: preCommissioningCount,
        completed: preCommissioningDoneCount,
      },
      commissioning: {
        status: commissioningStatus,
        total: preCommissioningDoneCount,
        completed: commissioningDoneCount,
      },
      warranty: {
        status: warrantyStatus,
        total: commissioningDoneCount,
        completed: warrantyDoneCount,
      },
    };
  }

  private mapToResponse(
    po: PurchaseOrderWithRelations,
    accordionStatus?: POAccordionStatus
  ): POResponse {
    const poItems: POItemResponse[] = (po.poItems || []).map((item) =>
      this.mapItemToResponse(item)
    );

    const totalPoCost = poItems.reduce((sum, item) => sum + (item.finalPrice || 0), 0);

    // Format date fields - Prisma returns Date objects
    const formatDate = (date: Date): string => {
      return date?.toISOString().split('T')[0];
    };

    return {
      poId: po.poId,
      clientId: po.clientId,
      clientName: po.client?.clientName,
      osgPiNo: po.osgPiNo,
      osgPiDate: formatDate(po.osgPiDate),
      clientPoNo: po.clientPoNo,
      clientPoDate: formatDate(po.clientPoDate),
      poStatus: po.poStatus,
      noOfDispatch: po.noOfDispatch,
      assignDispatchTo: po.assignDispatchTo,
      assignedUserName: po.assignedUser?.username || null,
      assignServiceTo: po.assignServiceTo,
      assignedServiceUserName: po.assignedServiceUser?.username || null,
      clientAddress: po.clientAddress,
      clientContact: po.clientContact,
      clientGST: po.client?.clientGST || null,
      poItems,
      dispatchPlanDate: formatDate(po.dispatchPlanDate),
      siteLocation: po.siteLocation,
      oscSupport: po.oscSupport,
      confirmDateOfDispatch: formatDate(po.confirmDateOfDispatch),
      paymentStatus: po.paymentStatus,
      remarks: po.remarks || null,
      totalPoCost,
      createdAt: po.createdAt.toISOString(),
      updatedAt: po.updatedAt.toISOString(),
      createdById: po.createdById ?? null,
      createdByName: po.createdBy?.username ?? null,
      accordionStatus,
    };
  }

  async createPO(data: CreatePORequest): Promise<POResponse> {
    const po = await this.poRepository.create(data);
    return this.mapToResponse(po);
  }

  async getPOById(poId: string): Promise<POResponse | null> {
    const po = await this.poRepository.findById(poId);
    if (!po) return null;

    // Calculate total PO quantity
    const totalPOQty = po.poItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate accordion status
    const accordionStatus = await this.calculateAccordionStatus(poId, totalPOQty);

    return this.mapToResponse(po, accordionStatus);
  }

  async getAllPOs(params: ListPORequest): Promise<POListResponse> {
    const { page = 1, limit = 10 } = params;
    const { rows, count } = await this.poRepository.findAll(params);

    return {
      data: rows.map((po) => this.mapToResponse(po)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async updatePO(poId: string, data: UpdatePORequest): Promise<POResponse | null> {
    const po = await this.poRepository.update(poId, data);
    if (!po) return null;

    // Calculate total PO quantity
    const totalPOQty = po.poItems.reduce((sum, item) => sum + item.quantity, 0);

    // Calculate accordion status
    const accordionStatus = await this.calculateAccordionStatus(poId, totalPOQty);

    return this.mapToResponse(po, accordionStatus);
  }

  async deletePO(poId: string): Promise<boolean> {
    return this.poRepository.delete(poId);
  }

  async getAccordionStatus(poId: string, totalPOQty: number): Promise<POAccordionStatus> {
    return this.calculateAccordionStatus(poId, totalPOQty);
  }

  buildResponseFromPO(
    po: PurchaseOrderWithRelations,
    accordionStatus?: POAccordionStatus
  ): POResponse {
    return this.mapToResponse(po, accordionStatus);
  }
}
