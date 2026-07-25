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
import { IClientService } from '../services/ClientService';
import { CreateClientRequest, UpdateClientRequest } from '../schemas/request/ClientRequest';

export interface IClientController {
  create(data: CreateClientRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(isActive?: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  update(
    id: string,
    data: UpdateClientRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/client', lambdaName: 'productManagement' })
@injectable()
export class ClientController implements IClientController {
  constructor(
    @inject(TYPES.ClientService)
    private clientService: IClientService
  ) {}

  @Post('/')
  async create(@Body() data: CreateClientRequest, @CurrentUser() currentUser: JWTPayload) {
    try {
      const enrichedData = {
        ...data,
        createdById: currentUser.userId,
        updatedById: currentUser.userId,
      };
      const client = await this.clientService.createClient(enrichedData);
      return createSuccessResponse(client, 201);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
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
  ) {
    try {
      const result = await this.clientService.getAllClients({
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
      return createErrorResponse(err as Error);
    }
  }

  @Get('/{id}')
  async getById(@Param('id') id: string) {
    try {
      const clientId = parseInt(id, 10);
      if (isNaN(clientId)) throw new ValidationError('Invalid client ID');
      const client = await this.clientService.getClientById(clientId);
      return createSuccessResponse(client);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateClientRequest,
    @CurrentUser() currentUser: JWTPayload
  ) {
    try {
      const clientId = parseInt(id, 10);
      if (isNaN(clientId)) throw new ValidationError('Invalid client ID');
      const enrichedData = {
        ...data,
        updatedById: currentUser.userId,
      };
      const updated = await this.clientService.updateClient(clientId, enrichedData);
      return createSuccessResponse(updated);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string) {
    try {
      const clientId = parseInt(id, 10);
      if (isNaN(clientId)) throw new ValidationError('Invalid client ID');
      await this.clientService.deleteClient(clientId);
      return createSuccessResponse({ deleted: true });
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }
}
