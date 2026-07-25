/**
 * Dispatch Response Schemas
 *
 * Response interfaces for Dispatch API endpoints.
 */

/**
 * Dispatched Item Response
 */
export interface DispatchedItemResponse {
  id: number;
  productId: number;
  productName?: string; // Resolved from relation
  poItemId?: number;
  quantity: number;
  warranty?: string;
  serialNumbers?: string;
}

/**
 * Dispatch Response
 */
export interface DispatchResponse {
  dispatchId: number;
  poId: string;

  // Dispatch Details (Section 1)
  dispatchedItems: DispatchedItemResponse[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string;
  deliveryContact: string;
  remarks?: string;

  // Document Fields (Section 2)
  noDuesClearance?: string;
  docOsgPiNo?: string;
  docOsgPiDate?: string;
  taxInvoiceNumber?: string;
  invoiceDate?: string;
  ewayBill?: string;
  deliveryChallan?: string;
  dispatchDate?: string;
  packagingList?: string;
  deliveryPincode?: string;
  dispatchStatus?: string;
  dispatchLrNo?: string;
  dispatchRemarks?: string;
  documentUpdatedAt?: string;

  // Delivery Confirmation Fields (Section 3)
  dateOfDelivery?: string;
  deliveryStatus?: string;
  proofOfDelivery?: string;
  deliveryUpdatedAt?: string;

  // Audit Fields
  createdById?: number;
  createdBy?: string; // Username
  updatedById?: number;
  updatedBy?: string; // Username
  createdAt: string;
  updatedAt: string;
}

/**
 * Dispatch List Response
 */
export interface DispatchListResponse {
  data: DispatchResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Delete Dispatch Response
 */
export interface DeleteDispatchResponse {
  dispatchId: number;
  deleted: boolean;
}

// Note: Accordion status is now consolidated in POResponse.accordionStatus
// The DispatchAccordionStatusResponse is deprecated - use POResponse.accordionStatus instead
