/**
 * Service Request Schemas
 *
 * Request interfaces for Service API endpoints.
 * Service includes: Pre-Commissioning (Section 1), Commissioning (Section 2), Warranty Certificate (Section 3)
 */

import { BaseListRequest } from './BaseListRequest';

/**
 * Create Service Request (Section 1: Pre-Commissioning)
 */
export interface CreateServiceRequest {
  dispatchId: number;
  serialNumber: string;
  productName: string;
  pcContact: string;
  assignedServiceEngineerId?: number;
  ppmChecklist: string;
  ppmSheetReceivedFromClient: string;
  ppmChecklistSharedWithOem: string;
  ppmTickedNoFromOem: string;
  ppmConfirmationStatus: string;
  oemComments?: string;
  preCommissioningStatus: string;
  remarks?: string;
  warranty?: string;
  createdById?: number;
  updatedById?: number;
}

/**
 * Update Service Request (Section 1: Pre-Commissioning)
 */
export interface UpdateServiceRequest {
  serialNumber?: string;
  productName?: string;
  pcContact?: string;
  assignedServiceEngineerId?: number;
  ppmChecklist?: string;
  ppmSheetReceivedFromClient?: string;
  ppmChecklistSharedWithOem?: string;
  ppmTickedNoFromOem?: string;
  ppmConfirmationStatus?: string;
  oemComments?: string;
  preCommissioningStatus?: string;
  remarks?: string;
  warranty?: string;
  updatedById?: number;
}

/**
 * Update Commissioning Request (Section 2)
 */
export interface UpdateCommissioningRequest {
  commissioningEcdFromClient?: string; // YYYY-MM-DD format
  commissioningServiceTicketNo?: string;
  commissioningIssues?: string;
  commissioningSolution?: string;
  commissioningDate?: string; // YYYY-MM-DD format
  commissioningStatus?: string;
  commissioningRemarks?: string;
  updatedById?: number;
}

/**
 * Update Warranty Request (Section 3)
 */
export interface UpdateWarrantyRequest {
  warrantyCertificateNo?: string;
  warrantyIssueDate?: string; // YYYY-MM-DD format
  warrantyStartDate?: string; // YYYY-MM-DD format
  warrantyEndDate?: string; // YYYY-MM-DD format
  warrantyStatus?: string;
  updatedById?: number;
}

/**
 * List Service Request
 */
export interface ListServiceRequest extends BaseListRequest {
  dispatchId?: number;
  poId?: string;
  preCommissioningStatus?: string;
  commissioningStatus?: string;
  warrantyStatus?: string;
  serialNumber?: string;
}
