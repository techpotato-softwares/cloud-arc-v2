import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  CurrentUser,
  createSuccessResponse,
  createErrorResponse,
  ValidationError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IOEMService } from '../services/OEMService';
import { CreateOEMRequest, UpdateOEMRequest } from '../schemas/request/OEMRequest';

export interface IOEMController {
  create(data: CreateOEMRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(isActive?: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  update(
    id: string,
    data: UpdateOEMRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/oem', lambdaName: 'productManagement' })
@injectable()
export class OEMController implements IOEMController {
  constructor(@inject(TYPES.OEMService) private oemService: IOEMService) {}

  @Post('/')
  async create(
    @Body() data: CreateOEMRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    try {
      const enrichedData = {
        ...data,
        createdById: currentUser.userId,
        updatedById: currentUser.userId,
      };
      const oem = await this.oemService.createOEM(enrichedData);
      return createSuccessResponse(oem, 201);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error creating OEM');
      return createErrorResponse(error);
    }
  }

  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('isActive') isActive?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.oemService.getAllOEMs({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        isActive: isActive ? isActive === 'true' : undefined,
        searchKey: searchKey || undefined,
        searchTerm: searchTerm || undefined,
      });
      const { data, pagination } = result;
      return createSuccessResponse({ data, pagination }, 200);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error fetching OEMs');
      return createErrorResponse(error);
    }
  }

  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    try {
      const oemId = parseInt(id, 10);
      if (isNaN(oemId)) throw new ValidationError('Invalid OEM ID');
      const oem = await this.oemService.getOEMById(oemId);
      return createSuccessResponse(oem);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error fetching OEM');
      return createErrorResponse(error);
    }
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateOEMRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    try {
      const oemId = parseInt(id, 10);
      if (isNaN(oemId)) throw new ValidationError('Invalid OEM ID');
      const enrichedData = {
        ...data,
        updatedById: currentUser.userId,
      };
      const oem = await this.oemService.updateOEM(oemId, enrichedData);
      return createSuccessResponse(oem);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error updating OEM');
      return createErrorResponse(error);
    }
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    try {
      const oemId = parseInt(id, 10);
      if (isNaN(oemId)) throw new ValidationError('Invalid OEM ID');
      await this.oemService.deleteOEM(oemId);
      return createSuccessResponse({ deleted: true });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error deleting OEM');
      return createErrorResponse(error);
    }
  }
}
