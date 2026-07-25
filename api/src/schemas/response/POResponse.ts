export interface POItemResponse {
  id: number;
  categoryId: number;
  categoryName?: string; // Resolved from relation
  oemId: number;
  oemName?: string; // Resolved from relation
  productId: number;
  productName?: string; // Resolved from relation
  quantity: number;
  spareQuantity: number;
  totalQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  gstPercent: number;
  finalPrice: number;
  warranty: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Accordion Status Type
 */
export type AccordionStatusType = 'Not Started' | 'In-Progress' | 'Done';

/**
 * Aggregated accordion status for all sections
 */
export interface POAccordionStatus {
  dispatch: {
    status: AccordionStatusType;
    totalQty: number;
    dispatchedQty: number;
  };
  document: {
    status: AccordionStatusType;
    total: number;
    completed: number;
  };
  delivery: {
    status: AccordionStatusType;
    total: number;
    completed: number;
  };
  preCommissioning: {
    status: AccordionStatusType;
    total: number;
    completed: number;
  };
  commissioning: {
    status: AccordionStatusType;
    total: number;
    completed: number;
  };
  warranty: {
    status: AccordionStatusType;
    total: number;
    completed: number;
  };
}

export interface POResponse {
  poId: string;
  clientId: number;
  clientName?: string; // Resolved from relation
  osgPiNo: string; // Alphanumeric
  osgPiDate: string;
  clientPoNo: string; // Alphanumeric
  clientPoDate: string;
  poStatus: string;
  noOfDispatch: string;
  assignDispatchTo: number | null;
  assignedUserName?: string | null; // Resolved from relation
  assignServiceTo: number | null;
  assignedServiceUserName?: string | null; // Resolved from relation
  clientAddress: string;
  clientContact: string;
  clientGST?: string | null; // Client GST number
  poItems: POItemResponse[];
  dispatchPlanDate: string;
  siteLocation: string;
  oscSupport: string;
  confirmDateOfDispatch: string;
  paymentStatus: string;
  remarks: string | null;
  totalPoCost: number; // Sum of all PO item finalPrice values
  createdAt: string;
  updatedAt: string;
  createdById?: number | null;
  createdByName?: string | null; // Resolved from relation
  // Accordion status for all sections
  accordionStatus?: POAccordionStatus;
}

export interface POListResponse {
  data: POResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeletePOResponse {
  poId: string;
  deleted: boolean;
}
