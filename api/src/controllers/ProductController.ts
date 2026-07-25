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
import { IProductService } from '../services/ProductService';
import { CreateProductRequest, UpdateProductRequest } from '../schemas/request/ProductRequest';

export interface IProductController {
  create(data: CreateProductRequest, currentUser: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(isActive?: string, categoryId?: string, oemId?: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  update(
    id: string,
    data: UpdateProductRequest,
    currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}

@Controller({ path: '/api/product', lambdaName: 'productManagement' })
@injectable()
export class ProductController implements IProductController {
  constructor(
    @inject(TYPES.ProductService)
    private productService: IProductService
  ) {}

  // CREATE
  @Post('/')
  async create(
    @Body() data: CreateProductRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    try {
      const enrichedData = {
        ...data,
        createdById: currentUser.userId,
        updatedById: currentUser.userId,
      };
      const product = await this.productService.createProduct(enrichedData);
      return createSuccessResponse(product, 201);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error creating product');
      return createErrorResponse(error);
    }
  }

  // GET ALL
  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('isActive') isActive?: string,
    @Query('categoryId') categoryId?: string,
    @Query('oemId') oemId?: string,
    @Query('searchKey') searchKey?: string,
    @Query('searchTerm') searchTerm?: string
  ): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.productService.getAllProducts({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        isActive: isActive ? isActive === 'true' : undefined,
        categoryId: categoryId
          ? typeof categoryId === 'string'
            ? parseInt(categoryId, 10)
            : categoryId
          : undefined,
        oemId: oemId ? (typeof oemId === 'string' ? parseInt(oemId, 10) : oemId) : undefined,
        searchKey: searchKey || undefined,
        searchTerm: searchTerm || undefined,
      });
      const { data, pagination } = result;
      return createSuccessResponse({ data, pagination }, 200);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error fetching products');
      return createErrorResponse(error);
    }
  }

  // GET BY ID
  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    try {
      const productId = parseInt(id, 10);
      if (isNaN(productId)) throw new ValidationError('Invalid product ID');
      const product = await this.productService.getProductById(productId);
      return createSuccessResponse(product);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error fetching product');
      return createErrorResponse(error);
    }
  }

  // UPDATE
  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateProductRequest,
    @CurrentUser() currentUser: JWTPayload
  ): Promise<APIGatewayProxyResult> {
    try {
      const productId = parseInt(id, 10);
      if (isNaN(productId)) throw new ValidationError('Invalid product ID');
      const enrichedData = {
        ...data,
        updatedById: currentUser.userId,
      };
      const product = await this.productService.updateProduct(productId, enrichedData);
      return createSuccessResponse(product);
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error updating product');
      return createErrorResponse(error);
    }
  }

  // DELETE
  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    try {
      const productId = parseInt(id, 10);
      if (isNaN(productId)) throw new ValidationError('Invalid product ID');
      await this.productService.deleteProduct(productId);
      return createSuccessResponse({ deleted: true });
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error('Error deleting product');
      return createErrorResponse(error);
    }
  }
}
