/**
 * Dispatch Controller
 *
 * Handles all dispatch-related API endpoints.
 * Endpoints:
 * - POST /api/dispatch - Create dispatch details (Section 1)
 * - GET /api/dispatch - Get all dispatches with pagination
 * - GET /api/dispatch/po/{poId} - Get all dispatches by PO ID
 * - GET /api/dispatch/{id} - Get dispatch by ID
 * - PUT /api/dispatch/{id} - Update dispatch details (Section 1)
 * - PUT /api/dispatch/{id}/documents - Update dispatch documents (Section 2)
 * - PUT /api/dispatch/{id}/delivery - Update delivery confirmation (Section 3)
 * - DELETE /api/dispatch/{id} - Delete dispatch
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
import { IDispatchService } from '../services/DispatchService';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
} from '../schemas';

export interface IDispatchController {
  create(data: CreateDispatchRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(
    page?: string,
    limit?: string,
    sortBy?: string,
    sortOrder?: string,
    poId?: string,
    dispatchStatus?: string,
    deliveryStatus?: string
  ): Promise<APIGatewayProxyResult>;
  getByPoId(poId: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  updateDetails(
    id: string,
    data: UpdateDispatchDetailsRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateDocuments(
    id: string,
    data: UpdateDispatchDocumentsRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateDelivery(
    id: string,
    data: UpdateDeliveryConfirmationRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/dispatch', lambdaName: 'dispatch' })
@injectable()
export class DispatchController implements IDispatchController {
  constructor(@inject(TYPES.DispatchService) private dispatchService: IDispatchService) {}

  /**
   * POST /api/dispatch
   * Create a new dispatch (Section 1: Dispatch Details)
   */
  @Post('/')
  async create(
    @Body() data: CreateDispatchRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    this.validateCreateRequest(data);
    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const dispatch = await this.dispatchService.createDispatch(enrichedData);
    return createSuccessResponse(dispatch, 201);
  }

  /**
   * GET /api/dispatch
   * Get all dispatches with pagination
   */
  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('poId') poId?: string,
    @Query('dispatchStatus') dispatchStatus?: string,
    @Query('deliveryStatus') deliveryStatus?: string
  ): Promise<APIGatewayProxyResult> {
    const params: ListDispatchRequest = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      poId: poId || undefined,
      dispatchStatus: dispatchStatus || undefined,
      deliveryStatus: deliveryStatus || undefined,
    };

    const result = await this.dispatchService.getAllDispatches(params);
    const { data, pagination } = result;
    return createSuccessResponse({ data, pagination }, 200);
  }

  /**
   * GET /api/dispatch/po/{poId}
   * Get all dispatches for a specific PO
   */
  @Get('/po/{poId}')
  async getByPoId(@Param('poId') poId: string): Promise<APIGatewayProxyResult> {
    if (!poId) {
      throw new ValidationError('PO ID is required');
    }

    const dispatches = await this.dispatchService.getDispatchesByPoId(poId);
    return createSuccessResponse(dispatches);
  }

  /**
   * GET /api/dispatch/po/{poId}/status
   * Get accordion status for Dispatch, Document, and Delivery sections
   */
  @Get('/po/{poId}/status')
  async getAccordionStatus(@Param('poId') poId: string): Promise<APIGatewayProxyResult> {
    if (!poId) {
      throw new ValidationError('PO ID is required');
    }

    const status = await this.dispatchService.getAccordionStatus(poId);
    return createSuccessResponse(status);
  }

  /**
   * GET /api/dispatch/{id}
   * Get dispatch by ID
   */
  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const dispatchId = parseInt(id, 10);
    if (isNaN(dispatchId)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const dispatch = await this.dispatchService.getDispatchById(dispatchId);

    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }

    return createSuccessResponse(dispatch);
  }

  /**
   * PUT /api/dispatch/{id}
   * Update dispatch details (Section 1)
   */
  @Put('/{id}')
  async updateDetails(
    @Param('id') id: string,
    @Body() data: UpdateDispatchDetailsRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const dispatchId = parseInt(id, 10);
    if (isNaN(dispatchId)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const dispatch = await this.dispatchService.updateDispatchDetails(dispatchId, updateData);

    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }

    return createSuccessResponse(dispatch);
  }

  /**
   * PUT /api/dispatch/{id}/documents
   * Update dispatch documents (Section 2)
   */
  @Put('/{id}/documents')
  async updateDocuments(
    @Param('id') id: string,
    @Body() data: UpdateDispatchDocumentsRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const dispatchId = parseInt(id, 10);
    if (isNaN(dispatchId)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const dispatch = await this.dispatchService.updateDispatchDocuments(dispatchId, updateData);

    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }

    return createSuccessResponse(dispatch);
  }

  /**
   * PUT /api/dispatch/{id}/delivery
   * Update delivery confirmation (Section 3)
   */
  @Put('/{id}/delivery')
  async updateDelivery(
    @Param('id') id: string,
    @Body() data: UpdateDeliveryConfirmationRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const dispatchId = parseInt(id, 10);
    if (isNaN(dispatchId)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const updateData = {
      ...data,
      updatedById: currentUser.userId,
    };
    const dispatch = await this.dispatchService.updateDeliveryConfirmation(dispatchId, updateData);

    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }

    return createSuccessResponse(dispatch);
  }

  /**
   * DELETE /api/dispatch/{id}
   * Delete a dispatch
   */
  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const dispatchId = parseInt(id, 10);
    if (isNaN(dispatchId)) {
      throw new ValidationError('Invalid dispatch ID');
    }

    const deleted = await this.dispatchService.deleteDispatch(dispatchId);

    if (!deleted) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }

    return createSuccessResponse({ dispatchId, deleted: true });
  }

  /**
   * Validate create dispatch request
   */
  private validateCreateRequest(data: CreateDispatchRequest): void {
    const requiredFields: (keyof CreateDispatchRequest)[] = [
      'poId',
      'projectName',
      'projectLocation',
      'deliveryLocation',
      'deliveryAddress',
      'confirmDispatchDate',
      'deliveryContact',
    ];

    for (const field of requiredFields) {
      if (data[field] === undefined || data[field] === null || data[field] === '') {
        throw new ValidationError(`Field '${field}' is required`);
      }
    }

    if (!data.dispatchedItems || data.dispatchedItems.length === 0) {
      throw new ValidationError('At least one dispatched item is required');
    }

    for (const item of data.dispatchedItems) {
      if (!item.productId) {
        throw new ValidationError('Each dispatched item must have a productId');
      }
      if (!item.quantity || item.quantity <= 0) {
        throw new ValidationError('Each dispatched item must have a positive quantity');
      }
    }
  }
}
