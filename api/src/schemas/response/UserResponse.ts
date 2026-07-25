export interface UserResponse {
  userId: number;
  username: string;
  email: string;
  password?: string;
  role: string; // Role name (for backward compatibility)
  roleId?: number; // Role ID (foreign key)
  isActive: boolean;

  // add other fields needed for response here
}

export interface UserListResponse {
  data: UserResponse[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
