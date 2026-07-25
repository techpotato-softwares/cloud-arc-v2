/**
 * Service Controller
 *
 * Handles all service-related API endpoints.
 * Service includes: Pre-Commissioning (Section 1), Commissioning (Section 2), Warranty Certificate (Section 3)
 * Endpoints:
 * - POST /api/service - Create service (Section 1: Pre-Commissioning)
 * - GET /api/service - Get all services with pagination
 * - GET /api/service/dispatch/{dispatchId} - Get all services by Dispatch ID
 * - GET /api/service/po/{poId} - Get all services by PO ID
 * - GET /api/service/{id} - Get service by ID
 * - PUT /api/service/{id} - Update service (Section 1: Pre-Commissioning)
 * - PUT /api/service/{id}/commissioning - Update commissioning (Section 2)
 * - PUT /api/service/{id}/warranty - Update warranty certificate (Section 3)
 * - DELETE /api/service/{id} - Delete service
 */

import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  CurrentUser,
  createSuccessResponse,
  NotFoundError,
  ValidationError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IServiceService } from '../services/ServiceService';
import {
  CreateServiceRequest,
  UpdateServiceRequest,
  UpdateCommissioningRequest,
  UpdateWarrantyRequest,
  ListServiceRequest,
} from '../schemas';

export interface IServiceController {
  create(data: CreateServiceRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(
    page?: string,
    limit?: string,
    sortBy?: string,
    sortOrder?: string,
    dispatchId?: string,
    poId?: string,
    preCommissioningStatus?: string,
    commissioningStatus?: string,
    warrantyStatus?: string,
    serialNumber?: string
  ): Promise<APIGatewayProxyResult>;
  getByDispatchId(dispatchId: string): Promise<APIGatewayProxyResult>;
  getByPoId(poId: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  updateService(
    id: string,
    data: UpdateServiceRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateCommissioning(
    id: string,
    data: UpdateCommissioningRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateWarranty(
    id: string,
    data: UpdateWarrantyRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/service', lambdaName: 'service' })
@injectable()
export class ServiceController implements IServiceController {
  constructor(@inject(TYPES.ServiceService) private serviceService: IServiceService) {}

  /**
   * POST /api/service
   * Create a new service (Section 1: Pre-Commissioning)
   */
  @Post('/')
  async create(
    @Body() data: CreateServiceRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    this.validateCreateRequest(data);
    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const service = await this.serviceService.createService(enrichedData);
    return createSuccessResponse(service, 201);
  }

  /**
   * GET /api/service
   * Get all services with pagination
   */
  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('dispatchId') dispatchId?: string,
    @Query('poId') poId?: string,
    @Query('preCommissioningStatus') preCommissioningStatus?: string,
    @Query('commissioningStatus') commissioningStatus?: string,
    @Query('warrantyStatus') warrantyStatus?: string,
    @Query('serialNumber') serialNumber?: string
  ): Promise<APIGatewayProxyResult> {
    const params: ListServiceRequest = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      dispatchId: dispatchId ? parseInt(dispatchId, 10) : undefined,
      poId: poId || undefined,
      preCommissioningStatus: preCommissioningStatus || undefined,
      commissioningStatus: commissioningStatus || undefined,
      warrantyStatus: warrantyStatus || undefined,
      serialNumber: serialNumber || undefined,
    };

    const result = await this.serviceService.getAllServices(params);
    const { data, pagination } = result;
    return createSuccessResponse({ data, pagination }, 200);
  }

  /**
   * GET /api/service/dispatch/{dispatchId}
   * Get all services for a specific dispatch
   */
  @Get('/dispatch/{dispatchId}')
  async getByDispatchId(@Param('dispatchId') dispatchId: string): Promise<APIGatewayProxyResult> {
    const dispatchIdNum = parseInt(dispatchId, 10);
    if (isNaN(dispatchIdNum)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const services = await this.serviceService.getServicesByDispatchId(dispatchIdNum);
    return createSuccessResponse(services);
  }

  /**
   * GET /api/service/po/{poId}
   * Get all services for a specific PO
   */
  @Get('/po/{poId}')
  async getByPoId(@Param('poId') poId: string): Promise<APIGatewayProxyResult> {
    if (!poId) {
      throw new ValidationError('PO ID is required');
    }

    const services = await this.serviceService.getServicesByPoId(poId);
    return createSuccessResponse(services);
  }

  /**
   * GET /api/service/{id}
   * Get service by ID
   */
  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      throw new ValidationError('Invalid service ID');
    }

    const service = await this.serviceService.getServiceById(serviceId);

    if (!service) {
      throw new NotFoundError(`Service with ID ${id} not found`);
    }

    return createSuccessResponse(service);
  }

  /**
   * PUT /api/service/{id}
   * Update service (Section 1: Pre-Commissioning)
   */
  @Put('/{id}')
  async updateService(
    @Param('id') id: string,
    @Body() data: UpdateServiceRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      throw new ValidationError('Invalid service ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const service = await this.serviceService.updateService(serviceId, updateData);

    if (!service) {
      throw new NotFoundError(`Service with ID ${id} not found`);
    }

    return createSuccessResponse(service);
  }

  /**
   * PUT /api/service/{id}/commissioning
   * Update commissioning (Section 2)
   */
  @Put('/{id}/commissioning')
  async updateCommissioning(
    @Param('id') id: string,
    @Body() data: UpdateCommissioningRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      throw new ValidationError('Invalid service ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const service = await this.serviceService.updateCommissioning(serviceId, updateData);

    if (!service) {
      throw new NotFoundError(`Service with ID ${id} not found`);
    }

    return createSuccessResponse(service);
  }

  /**
   * PUT /api/service/{id}/warranty
   * Update warranty certificate (Section 3)
   */
  @Put('/{id}/warranty')
  async updateWarranty(
    @Param('id') id: string,
    @Body() data: UpdateWarrantyRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      throw new ValidationError('Invalid service ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const service = await this.serviceService.updateWarranty(serviceId, updateData);

    if (!service) {
      throw new NotFoundError(`Service with ID ${id} not found`);
    }

    return createSuccessResponse(service);
  }

  /**
   * DELETE /api/service/{id}
   * Delete a service
   */
  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const serviceId = parseInt(id, 10);
    if (isNaN(serviceId)) {
      throw new ValidationError('Invalid service ID');
    }

    const deleted = await this.serviceService.deleteService(serviceId);

    if (!deleted) {
      throw new NotFoundError(`Service with ID ${id} not found`);
    }

    return createSuccessResponse({ serviceId, deleted: true });
  }

  /**
   * Validate create service request
   */
  private validateCreateRequest(data: CreateServiceRequest): void {
    const requiredFields: (keyof CreateServiceRequest)[] = [
      'dispatchId',
      'serialNumber',
      'productName',
      'pcContact',
      'ppmChecklist',
      'ppmSheetReceivedFromClient',
      'ppmChecklistSharedWithOem',
      'ppmTickedNoFromOem',
      'ppmConfirmationStatus',
      'preCommissioningStatus',
    ];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new ValidationError(`Field '${field}' is required`);
      }
    }

    if (typeof data.dispatchId !== 'number' || data.dispatchId <= 0) {
      throw new ValidationError('dispatchId must be a positive number');
    }
  }
}
