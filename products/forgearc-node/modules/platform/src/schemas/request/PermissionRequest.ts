export type {
  CreatePermissionRequest,
  UpdatePermissionRequest,
} from "../zod/rbac";
export {
  CreatePermissionRequestSchema,
  UpdatePermissionRequestSchema,
} from "../zod/rbac";

import { BaseListRequest } from "./BaseListRequest";

export interface ListPermissionRequest extends BaseListRequest {
  isActive?: boolean;
}
