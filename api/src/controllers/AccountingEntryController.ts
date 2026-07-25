/**
 * Accounting Entry Controller
 *
 * Handles all accounting entry API endpoints.
 * Endpoints:
 * - POST /api/accounting              - Create accounting entry
 * - GET  /api/accounting              - List all entries (paginated, filterable)
 * - GET  /api/accounting/po/{poId}    - Get entries by PO ID
 * - GET  /api/accounting/{id}         - Get entry by ID
 * - PUT  /api/accounting/{id}         - Update entry
 * - DELETE /api/accounting/{id}       - Delete entry
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
import { IAccountingEntryService } from '../services/AccountingEntryService';
import {
  CreateAccountingEntryRequest,
  UpdateAccountingEntryRequest,
  ListAccountingEntryRequest,
} from '../schemas';

@Controller({ path: '/api/accounting', lambdaName: 'accounting' })
@injectable()
export class AccountingEntryController {
  constructor(
    @inject(TYPES.AccountingEntryService)
    private accountingEntryService: IAccountingEntryService
  ) {}

  /**
   * POST /api/accounting
   * Create a new accounting entry
   */
  @Post('/')
  async create(
    @Body() data: CreateAccountingEntryRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    if (!data.poId) {
      throw new ValidationError("Field 'poId' is required");
    }
    const enrichedData = {
      ...data,
      createdById: currentUser.userId,
      updatedById: currentUser.userId,
    };
    const entry = await this.accountingEntryService.createEntry(enrichedData);
    return createSuccessResponse(entry, 201);
  }

  /**
   * GET /api/accounting
   * Get all accounting entries with pagination
   */
  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('poId') poId?: string,
    @Query('moduleType') moduleType?: string,
    @Query('dispatchId') dispatchId?: string,
    @Query('serviceId') serviceId?: string
  ): Promise<APIGatewayProxyResult> {
    const params: ListAccountingEntryRequest = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      poId: poId || undefined,
      moduleType: moduleType || undefined,
      dispatchId: dispatchId ? parseInt(dispatchId, 10) : undefined,
      serviceId: serviceId ? parseInt(serviceId, 10) : undefined,
    };
    const result = await this.accountingEntryService.getAllEntries(params);
    return createSuccessResponse({ data: result.data, pagination: result.pagination }, 200);
  }

  /**
   * GET /api/accounting/po/{poId}
   * Get all accounting entries for a specific PO
   */
  @Get('/po/{poId}')
  async getByPoId(
    @Param('poId') poId: string,
    @Query('moduleType') moduleType?: string
  ): Promise<APIGatewayProxyResult> {
    if (!poId) {
      throw new ValidationError('PO ID is required');
    }
    const entries = await this.accountingEntryService.getEntriesByPoId(
      poId,
      moduleType || undefined
    );
    return createSuccessResponse(entries);
  }

  /**
   * GET /api/accounting/{id}
   * Get accounting entry by ID
   */
  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new ValidationError('Invalid accounting entry ID');
    }
    const entry = await this.accountingEntryService.getEntryById(entryId);
    if (!entry) {
      throw new NotFoundError(`Accounting entry with ID ${id} not found`);
    }
    return createSuccessResponse(entry);
  }

  /**
   * PUT /api/accounting/{id}
   * Update an accounting entry
   */
  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateAccountingEntryRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new ValidationError('Invalid accounting entry ID');
    }
    const updateData = { ...data, updatedById: currentUser.userId };
    const entry = await this.accountingEntryService.updateEntry(entryId, updateData);
    if (!entry) {
      throw new NotFoundError(`Accounting entry with ID ${id} not found`);
    }
    return createSuccessResponse(entry);
  }

  /**
   * DELETE /api/accounting/{id}
   * Delete an accounting entry
   */
  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const entryId = parseInt(id, 10);
    if (isNaN(entryId)) {
      throw new ValidationError('Invalid accounting entry ID');
    }
    const deleted = await this.accountingEntryService.deleteEntry(entryId);
    if (!deleted) {
      throw new NotFoundError(`Accounting entry with ID ${id} not found`);
    }
    return createSuccessResponse({ id: entryId, deleted: true });
  }
}
