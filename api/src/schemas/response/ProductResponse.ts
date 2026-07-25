export interface ProductResponse {
  productId: number;
  productName: string;
  category: {
    categoryId: number;
    categoryName: string;
  };
  oem: {
    oemName: string;
    oemId: number;
  };
  isActive: boolean;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductListResponse {
  data: ProductResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
