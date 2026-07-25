import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IProductRepository } from '../repositories/ProductRepository';
import {
  CreateProductRequest,
  UpdateProductRequest,
  ListProductRequest,
} from '../schemas/request/ProductRequest';
import { ProductResponse, ProductListResponse } from '../schemas/response/ProductResponse';

export interface IProductService {
  createProduct(data: CreateProductRequest): Promise<ProductResponse | null>;
  getAllProducts(params?: ListProductRequest): Promise<ProductListResponse>;
  getProductById(id: number): Promise<ProductResponse | null>;
  updateProduct(id: number, data: UpdateProductRequest): Promise<ProductResponse | null>;
  deleteProduct(id: number): Promise<void>;
}

@injectable()
export class ProductService implements IProductService {
  constructor(@inject(TYPES.ProductRepository) private repo: IProductRepository) {}

  async createProduct(data: CreateProductRequest): Promise<ProductResponse | null> {
    const created = await this.repo.create(data);
    return created ?? null;
  }

  async getAllProducts(params?: ListProductRequest): Promise<ProductListResponse> {
    const { page = 1, limit = 20 } = params || {};
    const { rows, count } = await this.repo.findAll(params);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async getProductById(id: number): Promise<ProductResponse | null> {
    const p = await this.repo.findById(id);
    return p ?? null;
  }

  async updateProduct(id: number, data: UpdateProductRequest): Promise<ProductResponse | null> {
    await this.repo.update(id, data);
    return await this.repo.findById(id);
  }

  async deleteProduct(id: number): Promise<void> {
    await this.repo.delete(id);
  }
}
