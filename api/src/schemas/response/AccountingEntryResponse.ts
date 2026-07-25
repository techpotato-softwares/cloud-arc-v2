/**
 * Accounting Entry Response Schemas
 */

export interface AccountingEntryResponse {
  id: number;
  poId: string;
  moduleType: string;

  dispatchId?: number;
  serviceId?: number;

  // Sales & Invoice Master
  taxInvoiceNo?: string;
  taxInvoiceDate?: string;
  invoiceAmount?: string;
  paymentMode?: string;
  multiplePaymentRefNo?: string;

  // Payment & Collection Tracking
  paymentType?: string;
  paymentDate?: string;
  paymentDueDate?: string;
  paymentAmount?: string;
  tds?: string;
  balanceAmount?: string;
  noDuesClearanceStatus?: string;

  // Dispatch Cost Tracking
  dispatchExpenses?: string;
  dispatchExpensesRemark?: string;

  // Commissioning Cost Tracking
  commissioningExpenses?: string;
  commissioningExpensesRemark?: string;

  // Credit Note & Adjustment
  creditNoteRef?: string;
  creditNoteRemark?: string;

  // Audit
  createdById?: number;
  createdBy?: string;
  updatedById?: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingEntryListResponse {
  data: AccountingEntryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface DeleteAccountingEntryResponse {
  id: number;
  deleted: boolean;
}
