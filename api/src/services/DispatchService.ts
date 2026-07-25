/**
 * Dispatch Service
 *
 * Business logic layer for dispatch operations.
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import {
  IDispatchRepository,
  DispatchWithRelations,
  DispatchedItemWithRelations,
} from '../repositories/DispatchRepository';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
  DispatchResponse,
  DispatchListResponse,
  DispatchedItemResponse,
  DispatchAccordionStatusResponse,
  AccordionStatusType,
} from '../schemas';

export interface IDispatchService {
  createDispatch(data: CreateDispatchRequest): Promise<DispatchResponse>;
  getDispatchById(dispatchId: number): Promise<DispatchResponse | null>;
  getAllDispatches(params: ListDispatchRequest): Promise<DispatchListResponse>;
  getDispatchesByPoId(poId: string): Promise<DispatchResponse[]>;
  getAccordionStatus(poId: string): Promise<DispatchAccordionStatusResponse>;
  updateDispatchDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchResponse | null>;
  updateDispatchDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchResponse | null>;
  updateDeliveryConfirmation(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchResponse | null>;
  deleteDispatch(dispatchId: number): Promise<boolean>;
}

@injectable()
export class DispatchService implements IDispatchService {
  constructor(@inject(TYPES.DispatchRepository) private dispatchRepository: IDispatchRepository) {}

  /**
   * Format date to YYYY-MM-DD string
   */
  private formatDate(date: Date | null | undefined): string | undefined {
    if (!date) return undefined;
    return date.toISOString().split('T')[0];
  }

  /**
   * Format datetime to ISO string
   */
  private formatDateTime(date: Date | null | undefined): string | undefined {
    if (!date) return undefined;
    return date.toISOString();
  }

  /**
   * Map dispatched item to response format
   */
  private mapItemToResponse(item: DispatchedItemWithRelations): DispatchedItemResponse {
    return {
      id: item.id,
      productId: item.productId,
      productName: item.product?.productName,
      poItemId: item.poItemId ?? undefined,
      quantity: item.quantity,
      warranty: item.warranty || undefined,
      serialNumbers: item.serialNumbers || undefined,
    };
  }

  /**
   * Map dispatch to response format
   */
  private mapToResponse(dispatch: DispatchWithRelations): DispatchResponse {
    const dispatchedItems: DispatchedItemResponse[] = (dispatch.dispatchedItems || []).map((item) =>
      this.mapItemToResponse(item)
    );

    return {
      dispatchId: dispatch.dispatchId,
      poId: dispatch.poId,

      // Dispatch Details (Section 1)
      dispatchedItems,
      projectName: dispatch.projectName,
      projectLocation: dispatch.projectLocation,
      deliveryLocation: dispatch.deliveryLocation,
      deliveryAddress: dispatch.deliveryAddress,
      googleMapLink: dispatch.googleMapLink || undefined,
      confirmDispatchDate: this.formatDate(dispatch.confirmDispatchDate) || '',
      deliveryContact: dispatch.deliveryContact,
      remarks: dispatch.remarks || undefined,

      // Document Fields (Section 2)
      noDuesClearance: dispatch.noDuesClearance || undefined,
      docOsgPiNo: dispatch.docOsgPiNo || undefined,
      docOsgPiDate: this.formatDate(dispatch.docOsgPiDate),
      taxInvoiceNumber: dispatch.taxInvoiceNumber || undefined,
      invoiceDate: this.formatDate(dispatch.invoiceDate),
      ewayBill: dispatch.ewayBill || undefined,
      deliveryChallan: dispatch.deliveryChallan || undefined,
      dispatchDate: this.formatDate(dispatch.dispatchDate),
      packagingList: dispatch.packagingList || undefined,
      deliveryPincode: dispatch.deliveryPincode || undefined,
      dispatchStatus: dispatch.dispatchStatus || undefined,
      dispatchLrNo: dispatch.dispatchLrNo || undefined,
      dispatchRemarks: dispatch.dispatchRemarks || undefined,
      documentUpdatedAt: this.formatDateTime(dispatch.documentUpdatedAt),

      // Delivery Confirmation Fields (Section 3)
      dateOfDelivery: this.formatDate(dispatch.dateOfDelivery),
      deliveryStatus: dispatch.deliveryStatus || undefined,
      proofOfDelivery: dispatch.proofOfDelivery || undefined,
      deliveryUpdatedAt: this.formatDateTime(dispatch.deliveryUpdatedAt),

      // Audit Fields
      createdById: dispatch.createdById || undefined,
      createdBy: dispatch.createdBy?.username,
      updatedById: dispatch.updatedById || undefined,
      updatedBy: dispatch.updatedBy?.username,
      createdAt: dispatch.createdAt.toISOString(),
      updatedAt: dispatch.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new dispatch
   */
  async createDispatch(data: CreateDispatchRequest): Promise<DispatchResponse> {
    const dispatch = await this.dispatchRepository.create(data);
    return this.mapToResponse(dispatch);
  }

  /**
   * Get dispatch by ID
   */
  async getDispatchById(dispatchId: number): Promise<DispatchResponse | null> {
    const dispatch = await this.dispatchRepository.findById(dispatchId);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Get all dispatches with pagination
   */
  async getAllDispatches(params: ListDispatchRequest): Promise<DispatchListResponse> {
    const { page = 1, limit = 20 } = params;
    const { rows, count } = await this.dispatchRepository.findAll(params);

    return {
      data: rows.map((dispatch) => this.mapToResponse(dispatch)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get all dispatches for a specific PO
   */
  async getDispatchesByPoId(poId: string): Promise<DispatchResponse[]> {
    const dispatches = await this.dispatchRepository.findByPoId(poId);
    return dispatches.map((dispatch) => this.mapToResponse(dispatch));
  }

  /**
   * Get accordion status for Dispatch, Document, and Delivery sections
   * Calculates status based on dispatch data for a PO
   */
  async getAccordionStatus(poId: string): Promise<DispatchAccordionStatusResponse> {
    const dispatches = await this.dispatchRepository.findByPoId(poId);
    const poTotalQty = await this.dispatchRepository.getPOTotalQuantity(poId);

    // Calculate dispatched quantity
    const dispatchedQty = dispatches.reduce((sum, d) => {
      return sum + (d.dispatchedItems || []).reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);

    // Dispatch Status
    let dispatchStatus: AccordionStatusType = 'Not Started';
    if (dispatches.length > 0) {
      dispatchStatus = dispatchedQty >= poTotalQty ? 'Done' : 'In-Progress';
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
    let deliveryStatus: AccordionStatusType = 'Not Started';
    if (dispatchesForDelivery > 0 && dispatchesWithDelivery > 0) {
      deliveryStatus = dispatchesWithDelivery >= dispatchesForDelivery ? 'Done' : 'In-Progress';
    }

    return {
      dispatchStatus,
      totalQty: poTotalQty,
      dispatchedQty,
      documentStatus,
      dispatchesWithDocuments,
      dispatchesWithDoneDocuments,
      deliveryStatus,
      dispatchesForDelivery,
      dispatchesWithDelivery,
    };
  }

  /**
   * Update dispatch details (Section 1)
   */
  async updateDispatchDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchResponse | null> {
    const dispatch = await this.dispatchRepository.updateDetails(dispatchId, data);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Update dispatch documents (Section 2)
   */
  async updateDispatchDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchResponse | null> {
    const dispatch = await this.dispatchRepository.updateDocuments(dispatchId, data);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Update delivery confirmation (Section 3)
   */
  async updateDeliveryConfirmation(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchResponse | null> {
    const dispatch = await this.dispatchRepository.updateDelivery(dispatchId, data);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Delete a dispatch
   */
  async deleteDispatch(dispatchId: number): Promise<boolean> {
    return this.dispatchRepository.delete(dispatchId);
  }
}
