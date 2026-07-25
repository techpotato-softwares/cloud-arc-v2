/**
 * Accounting Entry Request Schemas
 *
 * Request interfaces for AccountingEntry API endpoints.
 * Covers: Sales & Invoice Master, Payment & Collection Tracking,
 * Dispatch Cost Tracking, Commissioning Cost Tracking, Credit Note & Adjustment
 */

import { BaseListRequest } from './BaseListRequest';

/**
 * Create Accounting Entry Request
 */
export interface CreateAccountingEntryRequest {
  poId: string;
  moduleType?: string; // "order" (default) | "service"
  dispatchId?: number;
  serviceId?: number;

  // Sales & Invoice Master
  taxInvoiceNo?: string;
  taxInvoiceDate?: string; // YYYY-MM-DD
  invoiceAmount?: number;
  paymentMode?: string;
  multiplePaymentRefNo?: string;

  // Payment & Collection Tracking
  paymentType?: string; // "advance" | "part_payment" | "credit_note"
  paymentDate?: string; // YYYY-MM-DD
  paymentDueDate?: string; // YYYY-MM-DD
  paymentAmount?: number;
  tds?: number;
  balanceAmount?: number;
  noDuesClearanceStatus?: string;

  // Dispatch Cost Tracking
  dispatchExpenses?: number;
  dispatchExpensesRemark?: string;

  // Commissioning Cost Tracking
  commissioningExpenses?: number;
  commissioningExpensesRemark?: string;

  // Credit Note & Adjustment
  creditNoteRef?: string;
  creditNoteRemark?: string;

  // Audit (set by controller)
  createdById?: number;
  updatedById?: number;
}

/**
 * Update Accounting Entry Request
 */
export interface UpdateAccountingEntryRequest {
  // Sales & Invoice Master
  taxInvoiceNo?: string;
  taxInvoiceDate?: string;
  invoiceAmount?: number;
  paymentMode?: string;
  multiplePaymentRefNo?: string;

  // Payment & Collection Tracking
  paymentType?: string; // "advance" | "part_payment" | "credit_note"
  paymentDate?: string;
  paymentDueDate?: string;
  paymentAmount?: number;
  tds?: number;
  balanceAmount?: number;
  noDuesClearanceStatus?: string;

  // Dispatch Cost Tracking
  dispatchExpenses?: number;
  dispatchExpensesRemark?: string;

  // Commissioning Cost Tracking
  commissioningExpenses?: number;
  commissioningExpensesRemark?: string;

  // Credit Note & Adjustment
  creditNoteRef?: string;
  creditNoteRemark?: string;

  updatedById?: number;
}

/**
 * List Accounting Entries Request
 */
export interface ListAccountingEntryRequest extends BaseListRequest {
  poId?: string;
  moduleType?: string;
  dispatchId?: number;
  serviceId?: number;
}
