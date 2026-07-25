export interface OEMResponse {
  oemId: number;
  name: string;
  isActive: boolean;
  createdById?: number | null;
  updatedById?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OEMListResponse {
  data: OEMResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
