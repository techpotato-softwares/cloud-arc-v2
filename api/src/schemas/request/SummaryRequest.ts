import { BaseListRequest } from './BaseListRequest';

export interface ListSummaryRequest extends BaseListRequest {
  clientId?: number | string;
  poStatus?: string;
  paymentStatus?: string;
  assignedTo?: number | string;
  /** ISO date (YYYY-MM-DD) - filter by clientPoDate >= dateFrom */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD) - filter by clientPoDate <= dateTo */
  dateTo?: string;
  /** Pipeline stage key: dispatch | document | delivery | preCommissioning | commissioning | warranty */
  pipelineStage?: string;
  /** Pipeline status: Not Started | In-Progress | Done */
  pipelineStatus?: string;
  /** Filter by Category (first in cascading sequence: Category → OEM → Product) */
  categoryId?: number | string;
  /** Filter by OEM (second in cascading sequence: Category → OEM → Product) */
  oemId?: number | string;
  /** Filter by Product (third in cascading sequence: Category → OEM → Product) */
  productId?: number | string;
  /** Filter by Salesman/User (createdById) */
  salesmanId?: number | string;
  /** Filter by Dispatch ID */
  dispatchId?: number | string;
  /** Filter by Service ID */
  serviceId?: number | string;
  /** Filter by Tax Invoice number (case-insensitive partial match) */
  taxInvoice?: string;
  /** For user-based filtering (auto-set by controller) */
  userId?: number | string;
}

export interface ProductReportRequest {
  productId?: number;
  oemId?: number;
  categoryId?: number;
  clientId?: number;
  salesPersonId?: number; // User ID - filters POs by createdById
  purchaseOrderId?: string; // PO ID (e.g., "OSG-YYYY-YY-NNNNNNNN") - filters PO items by poId
}
