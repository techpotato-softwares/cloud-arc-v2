export interface CategoryResponse {
  categoryId: number;
  categoryName: string;
  isActive: boolean;
  createdById?: number | null;
  updatedById?: number | null;
}

export interface CategoryListResponse {
  data: CategoryResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
