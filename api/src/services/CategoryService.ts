import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { ICategoryRepository } from '../repositories/CategoryRepository';
import {
  CreateCategoryRequest,
  UpdateCategoryRequest,
  ListCategoryRequest,
} from '../schemas/request/CategoryRequest';
import { CategoryResponse, CategoryListResponse } from '../schemas/response/CategoryResponse';

export interface ICategoryService {
  createCategory(data: CreateCategoryRequest): Promise<CategoryResponse>;
  getAllCategories(params?: ListCategoryRequest): Promise<CategoryListResponse>;
  getCategoryById(id: number): Promise<CategoryResponse | null>;
  updateCategory(id: number, data: UpdateCategoryRequest): Promise<CategoryResponse>;
  deleteCategory(id: number): Promise<void>;
}

@injectable()
export class CategoryService implements ICategoryService {
  constructor(
    @inject(TYPES.CategoryRepository)
    private categoryRepository: ICategoryRepository
  ) {}

  async createCategory(data: CreateCategoryRequest): Promise<CategoryResponse> {
    const created = await this.categoryRepository.create(data);
    return created;
  }

  async getAllCategories(params?: ListCategoryRequest): Promise<CategoryListResponse> {
    const { page = 1, limit = 20 } = params || {};
    const { rows, count } = await this.categoryRepository.findAll(params);

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

  async getCategoryById(id: number): Promise<CategoryResponse | null> {
    const category = await this.categoryRepository.findById(id);
    return category;
  }

  async updateCategory(id: number, data: UpdateCategoryRequest): Promise<CategoryResponse> {
    const updatedCategory = await this.categoryRepository.update(id, data);
    return updatedCategory;
  }

  async deleteCategory(id: number) {
    await this.categoryRepository.delete(id);
  }
}
