/**
 * Dispatch Request Schemas
 *
 * Request interfaces for Dispatch API endpoints.
 */

import { BaseListRequest } from './BaseListRequest';

/**
 * Dispatched Item Request
 */
export interface DispatchedItemRequest {
  productId: number;
  poItemId?: number; // References po_items.id
  quantity: number;
  warranty?: string;
  serialNumbers?: string; // Comma-separated serial numbers
}

/**
 * Create Dispatch Request (Section 1: Dispatch Details)
 */
export interface CreateDispatchRequest {
  poId: string;
  dispatchedItems: DispatchedItemRequest[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string; // YYYY-MM-DD format
  deliveryContact: string;
  remarks?: string;
  createdById?: number;
  updatedById?: number;
}

/**
 * Update Dispatch Details Request (Section 1)
 */
export interface UpdateDispatchDetailsRequest {
  dispatchedItems?: DispatchedItemRequest[];
  projectName?: string;
  projectLocation?: string;
  deliveryLocation?: string;
  deliveryAddress?: string;
  googleMapLink?: string;
  confirmDispatchDate?: string;
  deliveryContact?: string;
  remarks?: string;
  updatedById?: number;
}

/**
 * Update Dispatch Documents Request (Section 2)
 */
export interface UpdateDispatchDocumentsRequest {
  noDuesClearance?: string;
  docOsgPiNo?: string;
  docOsgPiDate?: string; // YYYY-MM-DD format
  taxInvoiceNumber?: string;
  invoiceDate?: string; // YYYY-MM-DD format
  ewayBill?: string;
  deliveryChallan?: string;
  dispatchDate?: string; // YYYY-MM-DD format
  packagingList?: string;
  deliveryPincode?: string;
  dispatchStatus?: string;
  dispatchLrNo?: string;
  dispatchRemarks?: string;
  // Serial numbers for each dispatched item
  serialNumbers?: Record<number, string>; // productId -> serialNumbers
  updatedById?: number;
}

/**
 * Update Delivery Confirmation Request (Section 3)
 */
export interface UpdateDeliveryConfirmationRequest {
  dateOfDelivery?: string; // YYYY-MM-DD format
  deliveryStatus?: string;
  proofOfDelivery?: string;
  updatedById?: number;
}

/**
 * List Dispatch Request
 */
export interface ListDispatchRequest extends BaseListRequest {
  poId?: string;
  dispatchStatus?: string;
  deliveryStatus?: string;
}
