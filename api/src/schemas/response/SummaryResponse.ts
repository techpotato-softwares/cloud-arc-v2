import { POResponse, POAccordionStatus } from './POResponse';

/**
 * Dispatch Summary for Summary Dashboard
 * Contains key dispatch fields needed for summary display
 */
export interface DispatchSummary {
  dispatchId: number;
  taxInvoiceNumber?: string;
  invoiceDate?: string;
  dispatchDate?: string;
  dispatchStatus?: string;
  deliveryStatus?: string;
  deliveryLocation?: string;
  deliveryPincode?: string;
  dispatchedQuantity: number;
}

/**
 * Service Summary for Summary Dashboard
 * Contains key service fields needed for summary display
 */
export interface ServiceSummary {
  serviceId: number;
  dispatchId: number;
  serialNumber: string;
  productName: string;
  ppmConfirmationStatus?: string;
  preCommissioningStatus?: string;
  commissioningDate?: string;
  commissioningEcdFromClient?: string;
  commissioningStatus?: string;
  assignedServiceEngineer?: string;
  warrantyStatus?: string;
  warrantyCertificateNo?: string;
}

/** Summary row: PO header fields + accordion status + aggregated data */
export interface SummaryRowResponse extends POResponse {
  accordionStatus: POAccordionStatus;
  /** Array of dispatch summaries */
  dispatches?: DispatchSummary[];
  /** Array of service summaries */
  services?: ServiceSummary[];
  /** Aggregated total price from PO items */
  totalPrice?: number;
  /** Aggregated final price from PO items */
  finalPrice?: number;
  /** Aggregated total quantity from PO items */
  totalQuantity?: number;
  /** Total amount received (payments + TDS) from accounting entries */
  amountReceived?: number;
  /** Remaining amount = totalPoCost - amountReceived */
  remainingAmount?: number;
  /** Total dispatched quantity */
  dispatchedQuantity?: number;
  /** Balance quantity (totalQuantity - dispatchedQuantity) */
  balanceQuantity?: number;
  /** Percentage of dispatch done */
  dispatchPercentage?: number;
  /** Total delivered quantity */
  deliveredQuantity?: number;
  /** Percentage of delivery done */
  deliveryPercentage?: number;
  /** Total commissioning quantity */
  commissioningQuantity?: number;
  /** Percentage of commissioning done */
  commissioningPercentage?: number;
  /** Total warranty quantity */
  warrantyQuantity?: number;
  /** Percentage of warranty done */
  warrantyPercentage?: number;
  /** Unique OEM names from PO items */
  oemNames?: string[];
  /** Unique category names from PO items */
  categoryNames?: string[];
  /** Unique product names from PO items */
  productNames?: string[];
}

export interface SummaryListResponse {
  data: SummaryRowResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SummaryStatsResponse {
  total: number;
  inProgress: number;
  pending: number;
  completed: number;
  /** Total price when filtering by OEM/Category/Product */
  totalPrice?: number;
  /** Final price when filtering by OEM/Category/Product */
  finalPrice?: number;
  /** Total quantity when filtering by OEM/Category/Product */
  totalQuantity?: number;
}

export interface ProductReportItemResponse {
  productId: number;
  productName: string;
  categoryName: string;
  oemName: string;
  totalQuantity: number;
  totalSpareQuantity: number;
  avgPricePerUnit: number;
  totalPrice: number;
  finalPrice: number;
}

export interface ProductReportResponse {
  data: ProductReportItemResponse[];
}
