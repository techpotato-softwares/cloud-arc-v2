export interface PermissionResponse {
  permissionId: number;
  permissionCode: string;
  permissionName: string;
  description: string | null;
  createdBy: string;
  updatedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionListResponse {
  data: PermissionResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
