# User, Role, and Permission Table Mapping Update

## Overview

This document outlines the changes required to update the relationship mapping between Users, Roles, and Permissions tables to implement a more streamlined and efficient authorization system.

## Current State

### Existing Relationships

1. **User ↔ Role**:
   - Users have a direct `roleId` field (1-to-1 relationship)
   - Additionally, there was a `UserRole` junction table (many-to-many) which created redundancy

2. **Role ↔ Permission**:
   - No direct relationship existed between Roles and Permissions
   - Permissions were managed separately without role assignment

3. **Permission Table**:
   - `permissionId` was using UUID as primary key

## Target State

### Required Relationships

1. **User ↔ Role**: **One-to-One (1:1)**
   - One user can have only one role
   - One role can be assigned to multiple users
   - Implementation: Direct foreign key relationship via `roleId` in Users table

2. **Role ↔ Permission**: **Many-to-Many (M:N)**
   - One role can have multiple permissions
   - One permission can be assigned to multiple roles
   - Implementation: Junction table `RolePermission` to manage the relationship

3. **Permission Table**:
   - `permissionId` should be an auto-incrementing integer (primary key)
   - Add `permissionCode` as a required unique field

## Database Schema Changes

### 1. Remove UserRole Junction Table

**Action**: Drop the `user_role_mappings` table entirely.

**Reason**: The direct `roleId` field in the Users table is sufficient for the 1-to-1 relationship.

```sql
-- Migration: Drop user_role_mappings table
DROP TABLE IF EXISTS user_role_mappings;
```

### 2. Update Users Table

**Current State**:

- Has `roleId` field (already correct for 1-to-1)
- Has `userRoles` relation (to be removed)

**Changes Required**:

- Remove `userRoles` relation from Prisma schema
- Keep `roleId` as nullable foreign key
- Ensure proper indexing on `roleId`

```prisma
model User {
  userId      String          @id @default(uuid()) @map("user_id")
  username    String          @unique @db.VarChar(100)
  email       String          @unique @db.VarChar(255)
  password    String          @db.VarChar(255)
  roleId      String?         @map("role_id") // 1-to-1 relationship
  role        Role?           @relation(fields: [roleId], references: [roleId], onDelete: SetNull)
  isActive    Boolean         @default(true) @map("is_active")
  // ... other fields
  assignedPOs PurchaseOrder[] // POs assigned to this user for dispatch

  @@index([roleId])
  @@map("users")
}
```

### 3. Update Roles Table

**Changes Required**:

- Remove `userRoles` relation
- Add `rolePermissions` relation for many-to-many with Permissions

```prisma
model Role {
  roleId      String          @id @default(uuid()) @map("role_id")
  roleName    String          @map("role_name") @db.VarChar(100)
  description String          @map("description") @db.VarChar(255)
  // ... other fields
  users       User[]          // Users with this role (1-to-1 via roleId)
  rolePermissions RolePermission[] // Many-to-many with Permissions

  @@index([roleName])
  @@index([isActive])
  @@map("roles")
}
```

### 4. Update Permissions Table

**Changes Required**:

- Change `permissionId` from UUID to auto-incrementing integer
- Add `permissionCode` as required unique field
- Add `rolePermissions` relation

```prisma
model Permission {
  permissionId   Int      @id @default(autoincrement()) @map("permission_id")
  permissionCode String   @unique @map("permission_code") @db.VarChar(100)
  permissionName String   @map("permission_name") @db.VarChar(100)
  description    String   @map("description") @db.VarChar(255)
  // ... other fields
  rolePermissions RolePermission[] // Many-to-many with Roles

  @@index([permissionName])
  @@index([permissionCode])
  @@index([isActive])
  @@map("permissions")
}
```

### 5. Create RolePermission Junction Table

**New Table**: `role_permissions`

```prisma
model RolePermission {
  rolePermissionId String   @id @default(uuid()) @map("role_permission_id")
  roleId           String   @map("role_id")
  permissionId     Int      @map("permission_id")
  role             Role     @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  permission       Permission @relation(fields: [permissionId], references: [permissionId], onDelete: Cascade)
  createdBy        String   @map("created_by") @db.VarChar(100)
  updatedBy        String   @map("updated_by") @db.VarChar(100)
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  @@unique([roleId, permissionId])
  @@index([roleId])
  @@index([permissionId])
  @@index([isActive])
  @@map("role_permissions")
}
```

## Implementation Steps

### Phase 1: Database Schema Updates

1. **Update Prisma Schema**
   - Remove `UserRole` model
   - Update `User` model (remove `userRoles` relation)
   - Update `Role` model (remove `userRoles`, add `rolePermissions`)
   - Update `Permission` model (change `permissionId` to Int, add `permissionCode`, add `rolePermissions`)
   - Add `RolePermission` model

2. **Create Migration**

   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate dev --name update_user_role_permission_mapping
   ```

3. **Regenerate Prisma Client**
   ```bash
   npx prisma generate
   ```

### Phase 2: Backend API Updates

#### 2.1 Update Repositories

**UserRepository.ts**:

- Remove all `userRoles` references
- Update `create()` method to only use `roleId`
- Update `findAll()` to remove `userRoles` from includes
- Update `findById()` to remove `userRoles` from includes
- Update `update()` to remove `UserRole` table operations

**RoleRepository.ts**:

- Add methods for permission management:
  - `assignPermissions(roleId, permissionIds[], createdBy)`
  - `removePermissions(roleId, permissionIds[])`
  - `syncPermissions(roleId, permissionIds[], updatedBy)`
- Update `findById()` to include `rolePermissions` with `permission` relation
- Update `findAll()` to include `rolePermissions` with `permission` relation
- Update `create()` to handle `permissionIds` if provided
- Update `update()` to sync permissions if `permissionIds` provided

**PermissionRepository.ts**:

- Update to handle `permissionId` as `number` instead of `string`
- Add `permissionCode` to create/update operations
- Update search fields to include `permissionCode`

#### 2.2 Update Services

**UserService.ts**:

- Remove `userRoles` extraction logic
- Use direct `role` relation for role name
- Simplify role extraction to: `user.role?.roleName`

**RoleService.ts**:

- Add `mapToResponse()` method to map role with permissions
- Include permissions in `RoleResponse`
- Handle permission assignment during create/update

**AuthService.ts**:

- Remove `userRoles` references
- Use direct `role` relation: `user.role?.roleName`

#### 2.3 Update Request/Response Schemas

**RoleRequest.ts**:

```typescript
export interface CreateRoleRequest {
  roleName: string;
  description?: string;
  isActive?: boolean;
  permissionIds?: number[]; // Array of permission IDs
}

export interface UpdateRoleRequest {
  roleName?: string;
  description?: string;
  isActive?: boolean;
  permissionIds?: number[]; // Array of permission IDs to sync
}
```

**RoleResponse.ts**:

```typescript
export interface RoleResponse {
  roleId: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
  permissions?: PermissionResponse[]; // Array of permissions
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

**PermissionRequest.ts**:

```typescript
export interface CreatePermissionRequest {
  permissionCode: string; // Required
  permissionName: string;
  description?: string;
  createdBy: string;
  isActive?: boolean;
}

export interface UpdatePermissionRequest {
  permissionCode?: string;
  permissionName?: string;
  description?: string;
  updatedBy: string;
  isActive?: boolean;
}
```

**PermissionResponse.ts**:

```typescript
export interface PermissionResponse {
  permissionId: number; // Changed from string to number
  permissionCode: string; // New field
  permissionName: string;
  description: string | null;
  createdBy: string;
  updatedBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### Phase 3: Frontend Updates

#### 3.1 Update API Services

**roleApi.ts**:

- Update `transformResponse` to handle nested `{ data, pagination }` structure
- Ensure permissions are included in role responses

**permissionApi.ts**:

- Update `transformResponse` to handle nested `{ data, pagination }` structure
- Update to handle `permissionId` as `number`

#### 3.2 Update Components

**RoleManagement.tsx**:

- Fetch permissions using `useGetPermissionsQuery`
- Pass permissions data to `AddRoleModal` as props
- Remove Permissions column from table (show in View modal only)
- Add View/Edit/Delete actions

**AddRoleModal.tsx**:

- Accept permissions as props instead of fetching internally
- Use multi-select dropdown for permissions
- Add "Select All" functionality
- Show loading state on submit button
- Handle `permissionIds` array in form submission

**ViewRoleModal.tsx** (New):

- Display role details including permissions list
- Show permission count and individual permission tags

**PermissionManagement.tsx**:

- Update to handle `permissionId` as `number`
- Add `permissionCode` field to forms
- Update delete handler to convert `number` to `string` for API

**AddPermissionModal.tsx**:

- Add `permissionCode` input field
- Update to handle `permissionId` as `number`
- Include `createdBy` and `updatedBy` in API calls

## Data Migration Considerations

### 1. UserRole Table Data

**Action**: Before dropping `user_role_mappings` table, migrate data:

```sql
-- Migrate UserRole data to User.roleId
-- If a user has multiple roles, use the most recent active role
UPDATE users u
SET role_id = (
  SELECT ur.role_id
  FROM user_role_mappings ur
  WHERE ur.user_id = u.user_id
    AND ur.is_active = true
  ORDER BY ur.created_at DESC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM user_role_mappings ur
  WHERE ur.user_id = u.user_id AND ur.is_active = true
);
```

### 2. Permission ID Migration

**Action**: If permissions already exist with UUID, create migration script:

```sql
-- Create temporary mapping table
CREATE TABLE permission_id_mapping (
  old_id UUID,
  new_id SERIAL
);

-- Generate new IDs and map
INSERT INTO permission_id_mapping (old_id)
SELECT permission_id FROM permissions ORDER BY created_at;

-- Update foreign keys in other tables (if any)
-- Then update permissions table
-- (This requires careful planning based on existing data)
```

**Note**: If starting fresh, this may not be necessary.

## API Endpoints Impact

### Updated Endpoints

1. **POST /api/role** - Create Role
   - Now accepts `permissionIds` array
   - Assigns permissions during creation

2. **PUT /api/role/{id}** - Update Role
   - Now accepts `permissionIds` array
   - Syncs permissions (adds/removes as needed)

3. **GET /api/role/{id}** - Get Role by ID
   - Now includes `permissions` array in response

4. **GET /api/role** - Get All Roles
   - Now includes `permissions` array for each role

5. **POST /api/permission** - Create Permission
   - Now requires `permissionCode` field
   - Returns `permissionId` as number

6. **PUT /api/permission/{id}** - Update Permission
   - Now accepts `permissionCode` field
   - ID parameter is now number

7. **DELETE /api/permission/{id}** - Delete Permission
   - ID parameter is now number

## Testing Checklist

### Database Tests

- [ ] Verify User-Role 1-to-1 relationship works correctly
- [ ] Verify Role-Permission many-to-many relationship works correctly
- [ ] Test cascade deletes (deleting role removes role-permission mappings)
- [ ] Test unique constraints on role_permissions table
- [ ] Verify permissionId is auto-incrementing integer

### API Tests

- [ ] Create role with permissions
- [ ] Update role permissions
- [ ] Get role with permissions included
- [ ] Create permission with permissionCode
- [ ] Update permission
- [ ] Delete permission
- [ ] User creation with roleId
- [ ] User update with roleId

### Frontend Tests

- [ ] Role management page loads correctly
- [ ] Add role modal shows permissions dropdown
- [ ] Select All functionality works
- [ ] View role modal displays permissions
- [ ] Permission management handles number IDs
- [ ] Permission code field is required

## Rollback Plan

If issues arise, rollback steps:

1. **Database Rollback**:

   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate resolve --rolled-back <migration_name>
   ```

2. **Code Rollback**:
   - Revert to previous commit
   - Restore UserRole table if needed
   - Restore previous API implementations

## Benefits of New Mapping

1. **Simplified User-Role Relationship**:
   - Removes redundant UserRole junction table
   - Direct 1-to-1 relationship is more intuitive
   - Easier to query and maintain

2. **Flexible Permission System**:
   - Many-to-many relationship allows permissions to be reused
   - Roles can have multiple permissions
   - Permissions can be assigned to multiple roles

3. **Better Performance**:
   - Fewer joins required for user-role queries
   - More efficient permission lookups

4. **Improved Data Integrity**:
   - Permission IDs as integers are more efficient
   - Permission codes provide unique identifiers
   - Better indexing opportunities

## Migration Timeline

1. **Week 1**: Database schema updates and migrations
2. **Week 2**: Backend API updates (repositories, services, controllers)
3. **Week 3**: Frontend updates and testing
4. **Week 4**: Integration testing and bug fixes
5. **Week 5**: Production deployment

## Notes

- Ensure all existing data is backed up before migration
- Test thoroughly in development/staging environment
- Coordinate with frontend team for API contract changes
- Update API documentation after changes
- Consider versioning API if breaking changes are significant

## References

- Prisma Schema: `api/layers/shared/nodejs/prisma/schema.prisma`
- Role Repository: `api/src/repositories/RoleRepository.ts`
- User Repository: `api/src/repositories/UserRepository.ts`
- Permission Repository: `api/src/repositories/PermissionRepository.ts`
- Role Service: `api/src/services/RoleService.ts`
- User Service: `api/src/services/UserService.ts`
