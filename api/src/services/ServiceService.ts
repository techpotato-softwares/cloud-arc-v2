/**
 * Service Service
 *
 * Business logic layer for service operations.
 * Service includes: Pre-Commissioning (Section 1), Commissioning (Section 2), Warranty Certificate (Section 3)
 */

import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IServiceRepository, ServiceWithRelations } from '../repositories/ServiceRepository';
import {
  CreateServiceRequest,
  UpdateServiceRequest,
  UpdateCommissioningRequest,
  UpdateWarrantyRequest,
  ListServiceRequest,
  ServiceResponse,
  ServiceListResponse,
} from '../schemas';

export interface IServiceService {
  createService(data: CreateServiceRequest): Promise<ServiceResponse>;
  getServiceById(serviceId: number): Promise<ServiceResponse | null>;
  getAllServices(params: ListServiceRequest): Promise<ServiceListResponse>;
  getServicesByDispatchId(dispatchId: number): Promise<ServiceResponse[]>;
  getServicesByPoId(poId: string): Promise<ServiceResponse[]>;
  updateService(serviceId: number, data: UpdateServiceRequest): Promise<ServiceResponse | null>;
  updateCommissioning(
    serviceId: number,
    data: UpdateCommissioningRequest
  ): Promise<ServiceResponse | null>;
  updateWarranty(serviceId: number, data: UpdateWarrantyRequest): Promise<ServiceResponse | null>;
  deleteService(serviceId: number): Promise<boolean>;
}

@injectable()
export class ServiceService implements IServiceService {
  constructor(@inject(TYPES.ServiceRepository) private serviceRepository: IServiceRepository) {}

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
   * Map service to response format
   */
  private mapToResponse(service: ServiceWithRelations): ServiceResponse {
    return {
      serviceId: service.serviceId,
      dispatchId: service.dispatchId,
      serialNumber: service.serialNumber,
      productName: service.productName,

      // Section 1: Pre-Commissioning Details
      pcContact: service.pcContact,
      assignedServiceEngineerId: service.assignedServiceEngineerId ?? undefined,
      assignedServiceEngineer: service.assignedServiceEngineer?.username,
      ppmChecklist: service.ppmChecklist,
      ppmSheetReceivedFromClient: service.ppmSheetReceivedFromClient,
      ppmChecklistSharedWithOem: service.ppmChecklistSharedWithOem,
      ppmTickedNoFromOem: service.ppmTickedNoFromOem,
      ppmConfirmationStatus: service.ppmConfirmationStatus,
      oemComments: service.oemComments || undefined,
      preCommissioningStatus: service.preCommissioningStatus,
      remarks: service.remarks || undefined,
      warranty: service.warranty || undefined,
      preCommissioningUpdatedAt: this.formatDateTime(service.preCommissioningUpdatedAt),

      // Section 2: Commissioning Details (Optional)
      commissioningEcdFromClient: service.commissioningEcdFromClient || undefined,
      commissioningServiceTicketNo: service.commissioningServiceTicketNo || undefined,
      commissioningIssues: service.commissioningIssues || undefined,
      commissioningSolution: service.commissioningSolution || undefined,
      commissioningDate: this.formatDate(service.commissioningDate),
      commissioningStatus: service.commissioningStatus || undefined,
      commissioningRemarks: service.commissioningRemarks || undefined,
      commissioningUpdatedAt: this.formatDateTime(service.commissioningUpdatedAt),

      // Section 3: Warranty Certificate Details (Optional)
      warrantyCertificateNo: service.warrantyCertificateNo || undefined,
      warrantyIssueDate: this.formatDate(service.warrantyIssueDate),
      warrantyStartDate: this.formatDate(service.warrantyStartDate),
      warrantyEndDate: this.formatDate(service.warrantyEndDate),
      warrantyStatus: service.warrantyStatus || undefined,
      warrantyUpdatedAt: this.formatDateTime(service.warrantyUpdatedAt),

      // Audit Fields
      createdById: service.createdById || undefined,
      createdBy: service.createdBy?.username,
      updatedById: service.updatedById || undefined,
      updatedBy: service.updatedBy?.username,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString(),
    };
  }

  /**
   * Create a new service (Section 1: Pre-Commissioning)
   */
  async createService(data: CreateServiceRequest): Promise<ServiceResponse> {
    const service = await this.serviceRepository.create(data);
    return this.mapToResponse(service);
  }

  /**
   * Get service by ID
   */
  async getServiceById(serviceId: number): Promise<ServiceResponse | null> {
    const service = await this.serviceRepository.findById(serviceId);
    return service ? this.mapToResponse(service) : null;
  }

  /**
   * Get all services with pagination
   */
  async getAllServices(params: ListServiceRequest): Promise<ServiceListResponse> {
    const { page = 1, limit = 20 } = params;
    const { rows, count } = await this.serviceRepository.findAll(params);

    return {
      data: rows.map((service) => this.mapToResponse(service)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Get all services for a specific dispatch
   */
  async getServicesByDispatchId(dispatchId: number): Promise<ServiceResponse[]> {
    const services = await this.serviceRepository.findByDispatchId(dispatchId);
    return services.map((service) => this.mapToResponse(service));
  }

  /**
   * Get all services for a specific PO (via dispatch)
   */
  async getServicesByPoId(poId: string): Promise<ServiceResponse[]> {
    const services = await this.serviceRepository.findByPoId(poId);
    return services.map((service) => this.mapToResponse(service));
  }

  /**
   * Update service (Section 1: Pre-Commissioning)
   */
  async updateService(
    serviceId: number,
    data: UpdateServiceRequest
  ): Promise<ServiceResponse | null> {
    const service = await this.serviceRepository.updateService(serviceId, data);
    return service ? this.mapToResponse(service) : null;
  }

  /**
   * Update commissioning (Section 2)
   */
  async updateCommissioning(
    serviceId: number,
    data: UpdateCommissioningRequest
  ): Promise<ServiceResponse | null> {
    const service = await this.serviceRepository.updateCommissioning(serviceId, data);
    return service ? this.mapToResponse(service) : null;
  }

  /**
   * Update warranty certificate (Section 3)
   */
  async updateWarranty(
    serviceId: number,
    data: UpdateWarrantyRequest
  ): Promise<ServiceResponse | null> {
    const service = await this.serviceRepository.updateWarranty(serviceId, data);
    return service ? this.mapToResponse(service) : null;
  }

  /**
   * Delete a service
   */
  async deleteService(serviceId: number): Promise<boolean> {
    return this.serviceRepository.delete(serviceId);
  }
}
