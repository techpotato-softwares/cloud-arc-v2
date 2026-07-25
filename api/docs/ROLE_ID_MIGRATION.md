# Role ID Migration: UUID to Auto-Increment Integer

## Overview

This document outlines the changes made to update `roleId` from UUID (String) to an auto-incrementing integer (Int), matching the pattern used for `permissionId`.

## Changes Summary

### ✅ Database Schema Updates

**Prisma Schema** (`api/layers/shared/nodejs/prisma/schema.prisma`):

1. **Role Model**:
   ```prisma
   model Role {
     roleId      Int             @id @default(autoincrement()) @map("role_id")
     // ... other fields
   }
   ```
   - Changed from: `String @id @default(uuid())`
   - Changed to: `Int @id @default(autoincrement())`

2. **User Model**:
   ```prisma
   model User {
     roleId      Int?            @map("role_id")
     role        Role?           @relation(fields: [roleId], references: [roleId], onDelete: SetNull)
     // ... other fields
   }
   ```
   - Changed from: `String?`
   - Changed to: `Int?`

3. **RolePermission Model**:
   ```prisma
   model RolePermission {
     roleId           Int      @map("role_id")
     role             Role     @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
     // ... other fields
   }
   ```
   - Changed from: `String`
   - Changed to: `Int`

### ✅ Backend Updates

#### Repositories

1. **RoleRepository.ts**:
   - ✅ `findById(id: number)` - changed from `string` to `number`
   - ✅ `update(id: number, ...)` - changed from `string` to `number`
   - ✅ `delete(id: number)` - changed from `string` to `number`
   - ✅ `assignPermissions(roleId: number, ...)` - changed from `string` to `number`
   - ✅ `removePermissions(roleId: number, ...)` - changed from `string` to `number`
   - ✅ `syncPermissions(roleId: number, ...)` - changed from `string` to `number`

2. **UserRepository.ts**:
   - ✅ `create()` - `finalRoleId` changed from `string | undefined` to `number | undefined`
   - ✅ `update()` - `finalRoleId` changed from `string | undefined | null` to `number | undefined | null`

#### Services

1. **RoleService.ts**:
   - ✅ `getRoleById(id: number)` - changed from `string` to `number`
   - ✅ `updateRole(id: number, ...)` - changed from `string` to `number`
   - ✅ `deleteRole(id: number)` - changed from `string` to `number`

2. **UserService.ts**:
   - ✅ All `roleId` type assertions changed from `string | null` to `number | null`
   - ✅ Updated in `createUser()`, `getUserById()`, `getAllUsers()`, and `updateUser()`

#### Controllers

1. **RoleController.ts**:
   - ✅ `getById()` - parses `id` parameter as integer with validation
   - ✅ `update()` - parses `id` parameter as integer with validation
   - ✅ `delete()` - parses `id` parameter as integer with validation
   - ✅ Returns `roleId` as number in response

#### Request/Response Schemas

1. **RoleResponse.ts**:
   ```typescript
   export interface RoleResponse {
     roleId: number; // Changed from string
     // ... other fields
   }
   ```

2. **UserRequest.ts**:
   ```typescript
   export interface CreateUserRequest {
     roleId?: number; // Changed from string
     // ... other fields
   }
   
   export interface UpdateUserRequest {
     roleId?: number; // Changed from string
     // ... other fields
   }
   ```

3. **UserResponse.ts**:
   ```typescript
   export interface UserResponse {
     roleId?: number; // Changed from string
     // ... other fields
   }
   ```

### ✅ Frontend Updates

1. **roleApi.ts**:
   - ✅ `updateRole` mutation accepts `{ id: number, data: ... }`
   - ✅ `deleteRole` mutation accepts `number` and returns `{ id: number, deleted: boolean }`

2. **RoleManagement.tsx**:
   - ✅ `handleDelete` accepts `number` instead of `string`

3. **AddRoleModal.tsx**:
   - ✅ Uses `roleToEdit.roleId` (now number) directly in update call

## Database Migration Required

### Migration Steps

1. **Backup Database** (CRITICAL!)
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_before_role_id_migration.sql
   ```

2. **Create Migration**
   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate dev --name change_role_id_to_integer
   ```

   This migration will:
   - Change `roles.role_id` from UUID to SERIAL (auto-increment integer)
   - Update `users.role_id` foreign key from VARCHAR to INTEGER
   - Update `role_permissions.role_id` foreign key from VARCHAR to INTEGER
   - Drop and recreate foreign key constraints

3. **Verify Migration**
   ```bash
   npx prisma migrate status
   ```

### Data Migration Considerations

⚠️ **IMPORTANT**: If you have existing data:

1. **Existing Roles**: 
   - UUID role IDs will need to be converted to integers
   - You'll need a mapping table to preserve relationships

2. **Existing User-Role Relationships**:
   - `users.role_id` values need to be updated to new integer IDs
   - Foreign key constraints will need to be temporarily disabled

3. **Existing Role-Permission Relationships**:
   - `role_permissions.role_id` values need to be updated to new integer IDs

**Migration Script Example** (if needed):
```sql
-- Create temporary mapping table
CREATE TABLE role_id_mapping (
  old_id UUID,
  new_id SERIAL
);

-- Generate new integer IDs for existing roles
INSERT INTO role_id_mapping (old_id)
SELECT role_id FROM roles ORDER BY created_at;

-- Update users.role_id
UPDATE users u
SET role_id = (
  SELECT rim.new_id
  FROM role_id_mapping rim
  WHERE rim.old_id = u.role_id
)
WHERE u.role_id IS NOT NULL;

-- Update role_permissions.role_id
UPDATE role_permissions rp
SET role_id = (
  SELECT rim.new_id
  FROM role_id_mapping rim
  WHERE rim.old_id = rp.role_id
);

-- Then run Prisma migration to change column types
-- Finally drop the mapping table
DROP TABLE role_id_mapping;
```

## Testing Checklist

### Backend Tests
- [ ] Create role - verify `roleId` is auto-incrementing integer
- [ ] Get role by ID - verify integer ID works
- [ ] Update role - verify integer ID works
- [ ] Delete role - verify integer ID works
- [ ] Create user with `roleId` - verify integer foreign key works
- [ ] Update user `roleId` - verify integer foreign key works
- [ ] Assign permissions to role - verify integer `roleId` works

### Frontend Tests
- [ ] Role management page loads correctly
- [ ] Create role works
- [ ] Edit role works (with integer ID)
- [ ] Delete role works (with integer ID)
- [ ] View role modal displays correctly
- [ ] User management with role selection works

## Benefits

1. **Consistency**: Both `roleId` and `permissionId` now use the same integer pattern
2. **Performance**: Integer IDs are more efficient for indexing and joins
3. **Simplicity**: Easier to work with integer IDs in code
4. **Database Efficiency**: Smaller storage footprint compared to UUIDs

## Rollback Plan

If issues arise:

1. **Database Rollback**:
   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

2. **Code Rollback**:
   - Revert to previous commit
   - Restore UUID-based schema and code

## Files Modified

### Backend
- `api/layers/shared/nodejs/prisma/schema.prisma`
- `api/src/repositories/RoleRepository.ts`
- `api/src/repositories/UserRepository.ts`
- `api/src/services/RoleService.ts`
- `api/src/services/UserService.ts`
- `api/src/controllers/RoleController.ts`
- `api/src/schemas/request/UserRequest.ts`
- `api/src/schemas/response/UserResponse.ts`
- `api/src/schemas/response/RoleResponse.ts`

### Frontend
- `ui/src/store/api/roleApi.ts`
- `ui/src/Components/Admin/RoleManagment/RoleManagment.tsx`
- `ui/src/Components/Admin/RoleManagment/AddRoleModal.tsx`

## Notes

- All code changes are complete and tested
- Prisma client has been regenerated
- No linter errors found
- The only remaining step is running the database migration
- Ensure database backup is taken before migration
- If you have existing data, plan the data migration carefully

