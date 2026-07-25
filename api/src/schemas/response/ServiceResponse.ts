/**
 * Service Response Schemas
 *
 * Response interfaces for Service API endpoints.
 */

/**
 * Service Response
 */
export interface ServiceResponse {
  serviceId: number;
  dispatchId: number;
  serialNumber: string;
  productName: string;

  // Section 1: Pre-Commissioning Details
  pcContact: string;
  assignedServiceEngineerId?: number;
  assignedServiceEngineer?: string; // username for display
  ppmChecklist: string;
  ppmSheetReceivedFromClient: string;
  ppmChecklistSharedWithOem: string;
  ppmTickedNoFromOem: string;
  ppmConfirmationStatus: string;
  oemComments?: string;
  preCommissioningStatus: string;
  remarks?: string;
  warranty?: string;
  preCommissioningUpdatedAt?: string;

  // Section 2: Commissioning Details (Optional)
  commissioningEcdFromClient?: string; // YYYY-MM-DD format
  commissioningServiceTicketNo?: string;
  commissioningIssues?: string;
  commissioningSolution?: string;
  commissioningDate?: string;
  commissioningStatus?: string;
  commissioningRemarks?: string;
  commissioningUpdatedAt?: string;

  // Section 3: Warranty Certificate Details (Optional)
  warrantyCertificateNo?: string;
  warrantyIssueDate?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyStatus?: string;
  warrantyUpdatedAt?: string;

  // Audit Fields
  createdById?: number;
  createdBy?: string; // Username
  updatedById?: number;
  updatedBy?: string; // Username
  createdAt: string;
  updatedAt: string;
}

/**
 * Service List Response
 */
export interface ServiceListResponse {
  data: ServiceResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Delete Service Response
 */
export interface DeleteServiceResponse {
  serviceId: number;
  deleted: boolean;
}
