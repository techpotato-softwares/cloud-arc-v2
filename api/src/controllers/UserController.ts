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
  ValidationError,
  JWTPayload,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IUserService } from '../services/UserService';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ListUserRequest,
} from '../schemas/request/UserRequest';

export interface IUserController {
  create(data: CreateUserRequest, currentUser?: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  update(
    id: string,
    data: UpdateUserRequest,
    currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/user', lambdaName: 'user' })
@injectable()
export class UserController implements IUserController {
  constructor(@inject(TYPES.UserService) private userService: IUserService) {}

  @Post('/')
  async create(
    @Body() data: CreateUserRequest,
    @CurrentUser() currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const enrichedData = {
      ...data,
      createdById: currentUser?.userId,
      updatedById: currentUser?.userId,
    };
    const user = await this.userService.createUser(enrichedData);
    return createSuccessResponse(user, 201);
  }

  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string
  ): Promise<APIGatewayProxyResult> {
    const params: ListUserRequest = {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      searchKey: searchKey || undefined,
      searchTerm: searchTerm || undefined,
    };

    const result = await this.userService.getAllUsers(params);
    const { data, pagination } = result;
    return createSuccessResponse({ data, pagination }, 200);
  }

  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new ValidationError('Invalid user ID');
    const user = await this.userService.getUserById(userId);
    return createSuccessResponse(user);
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateUserRequest,
    @CurrentUser() currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new ValidationError('Invalid user ID');
    const enrichedData = {
      ...data,
      updatedById: currentUser?.userId,
    };
    const user = await this.userService.updateUser(userId, enrichedData);
    return createSuccessResponse(user);
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const userId = parseInt(id, 10);
    if (isNaN(userId)) throw new ValidationError('Invalid user ID');
    const user = await this.userService.deleteUser(userId);
    return createSuccessResponse(user);
  }
}
