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
import { ICategoryService } from '../services/CategoryService';
import { CreateCategoryRequest, UpdateCategoryRequest } from '../schemas/request/CategoryRequest';

export interface ICategoryController {
  create(data: CreateCategoryRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(isActive?: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  update(
    id: string,
    data: UpdateCategoryRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}
@Controller({ path: '/api/category', lambdaName: 'productManagement' })
@injectable()
export class CategoryController implements ICategoryController {
  constructor(
    @inject(TYPES.CategoryService)
    private categoryService: ICategoryService
  ) {}

  @Post('/')
  async create(@Body() data: CreateCategoryRequest, @CurrentUser() currentUser: JWTPayload) {
    try {
      const enrichedData = {
        ...data,
        createdById: currentUser.userId,
        updatedById: currentUser.userId,
      };
      const category = await this.categoryService.createCategory(enrichedData);
      return createSuccessResponse(category, 201);
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
      const result = await this.categoryService.getAllCategories({
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
      const categoryId = parseInt(id, 10);
      if (isNaN(categoryId)) throw new ValidationError('Invalid category ID');
      const category = await this.categoryService.getCategoryById(categoryId);
      return createSuccessResponse(category);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateCategoryRequest,
    @CurrentUser() currentUser: JWTPayload
  ) {
    try {
      const categoryId = parseInt(id, 10);
      if (isNaN(categoryId)) throw new ValidationError('Invalid category ID');
      const enrichedData = {
        ...data,
        updatedById: currentUser.userId,
      };
      const updated = await this.categoryService.updateCategory(categoryId, enrichedData);
      return createSuccessResponse(updated);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string) {
    try {
      const categoryId = parseInt(id, 10);
      if (isNaN(categoryId)) throw new ValidationError('Invalid category ID');
      await this.categoryService.deleteCategory(categoryId);
      return createSuccessResponse({ deleted: true });
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }
}
