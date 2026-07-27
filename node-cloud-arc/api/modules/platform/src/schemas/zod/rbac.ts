import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

const sortOrderSchema = z.enum(['ASC', 'DESC']);

export const BaseListQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().optional(),
    sortBy: z.string().optional(),
    sortOrder: sortOrderSchema.optional(),
    searchKey: z.string().optional(),
    searchTerm: z.string().optional(),
  })
  .openapi('BaseListQuery');

export const LoginRequestSchema = z
  .object({
    username: z.string().min(1),
    password: z.string().min(1),
  })
  .openapi('LoginRequest');

export const RefreshRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .openapi('RefreshRequest');

export const UserInfoSchema = z
  .object({
    userId: z.number().int(),
    username: z.string(),
    email: z.string().email(),
    roleName: z.string().nullable().optional(),
    roleId: z.number().int().nullable().optional(),
    permissions: z.array(z.string()),
  })
  .openapi('UserInfo');

export const LoginResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
    refreshExpiresIn: z.number(),
    user: UserInfoSchema,
  })
  .openapi('LoginResponse');

export const RefreshResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresIn: z.number(),
    refreshExpiresIn: z.number(),
  })
  .openapi('RefreshResponse');

export const CreateUserRequestSchema = z
  .object({
    username: z.string().min(1),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.string().optional(),
    roleId: z.number().int().optional(),
    isActive: z.boolean().optional(),
    createdById: z.number().int().optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('CreateUserRequest');

export const UpdateUserRequestSchema = z
  .object({
    username: z.string().min(1).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    role: z.string().optional(),
    roleId: z.number().int().optional(),
    isActive: z.boolean().optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('UpdateUserRequest');

export const UserResponseSchema = z
  .object({
    userId: z.number().int(),
    username: z.string(),
    email: z.string(),
    password: z.string().optional(),
    role: z.string(),
    roleId: z.number().int().optional(),
    isActive: z.boolean(),
  })
  .openapi('UserResponse');

export const CreateRoleRequestSchema = z
  .object({
    roleName: z.string().min(1),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    permissionIds: z.array(z.number().int()).optional(),
    createdById: z.number().int().optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('CreateRoleRequest');

export const UpdateRoleRequestSchema = z
  .object({
    roleName: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    permissionIds: z.array(z.number().int()).optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('UpdateRoleRequest');

export const CreatePermissionRequestSchema = z
  .object({
    permissionCode: z.string().min(1),
    permissionName: z.string().min(1),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    createdById: z.number().int().optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('CreatePermissionRequest');

export const UpdatePermissionRequestSchema = z
  .object({
    permissionCode: z.string().min(1).optional(),
    permissionName: z.string().min(1).optional(),
    description: z.string().optional(),
    isActive: z.boolean().optional(),
    updatedById: z.number().int().optional(),
  })
  .openapi('UpdatePermissionRequest');

export type UserInfo = z.infer<typeof UserInfoSchema>;
export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;
export type CreateUserRequest = z.infer<typeof CreateUserRequestSchema>;
export type UpdateUserRequest = z.infer<typeof UpdateUserRequestSchema>;
export type UserResponse = z.infer<typeof UserResponseSchema>;
export type CreateRoleRequest = z.infer<typeof CreateRoleRequestSchema>;
export type UpdateRoleRequest = z.infer<typeof UpdateRoleRequestSchema>;
export type CreatePermissionRequest = z.infer<typeof CreatePermissionRequestSchema>;
export type UpdatePermissionRequest = z.infer<typeof UpdatePermissionRequestSchema>;
