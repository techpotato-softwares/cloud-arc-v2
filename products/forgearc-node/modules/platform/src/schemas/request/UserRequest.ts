export type { CreateUserRequest, UpdateUserRequest } from "../zod/rbac";
export { CreateUserRequestSchema, UpdateUserRequestSchema } from "../zod/rbac";

import { BaseListRequest } from "./BaseListRequest";

export interface ListUserRequest extends BaseListRequest {
  role?: string;
  status?: string;
}
