export type { CreateRoleRequest, UpdateRoleRequest } from "../zod/rbac";
export { CreateRoleRequestSchema, UpdateRoleRequestSchema } from "../zod/rbac";

import { BaseListRequest } from "./BaseListRequest";

export interface ListRoleRequest extends BaseListRequest {
  isActive?: boolean;
}
