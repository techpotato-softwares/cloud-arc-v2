import type { UserResponse } from '../zod/rbac';

export type { UserResponse } from '../zod/rbac';
export { UserResponseSchema } from '../zod/rbac';

export interface UserListResponse {
  data: UserResponse[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
