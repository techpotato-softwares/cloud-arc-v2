# UUID to Auto-Increment Integer Migration

## Overview

This document outlines the comprehensive migration of all primary keys from UUID (String) to auto-incrementing integers (Int) across the entire application.

## Tables Updated

The following tables have been migrated from UUID to auto-incrementing integer primary keys:

1. ✅ **POItem** - `id` (String UUID → Int auto-increment)
2. ✅ **User** - `userId` (String UUID → Int auto-increment)
3. ✅ **RolePermission** - `rolePermissionId` (String UUID → Int auto-increment)
4. ✅ **Category** - `categoryId` (String UUID → Int auto-increment)
5. ✅ **OEM** - `oemId` (String UUID → Int auto-increment)
6. ✅ **Product** - `productId` (String UUID → Int auto-increment)
7. ✅ **Client** - `clientId` (String UUID → Int auto-increment)

**Note**: `PurchaseOrder.poId` remains as String (custom format: OSG-00000001) as it uses a custom ID generation strategy.

## Foreign Key Updates

The following foreign keys have been updated to reference integer IDs:

1. ✅ **User.roleId** - Already Int (from previous migration)
2. ✅ **PurchaseOrder.clientId** - String → Int
3. ✅ **PurchaseOrder.assignDispatchTo** - String → Int (references User.userId)
4. ✅ **POItem.categoryId** - String → Int
5. ✅ **POItem.oemId** - String → Int
6. ✅ **POItem.productId** - String → Int
7. ✅ **Product.categoryId** - String → Int
8. ✅ **Product.oemId** - String → Int
9. ✅ **RolePermission.roleId** - Already Int (from previous migration)
10. ✅ **RolePermission.permissionId** - Already Int (from previous migration)

## Backend Changes Completed

### ✅ Prisma Schema
- All primary keys changed from `String @default(uuid())` to `Int @default(autoincrement())`
- All foreign keys updated to reference integer IDs
- Prisma client regenerated successfully

### ✅ Repositories
All repositories updated to use `number` for ID parameters:
- `CategoryRepository` - `findById`, `update`, `delete` now accept `number`
- `OEMRepository` - `findById`, `update`, `delete` now accept `number`
- `ProductRepository` - `findById`, `update`, `delete` now accept `number`, handles string-to-int conversion for `categoryId` and `oemId` in queries
- `ClientRepository` - `findById`, `update`, `delete` now accept `number`
- `UserRepository` - `findById`, `update`, `delete` now accept `number`
- `PORepository` - Updated to handle integer foreign keys (`clientId`, `assignDispatchTo`, `categoryId`, `oemId`, `productId`)

### ✅ Services
All services updated to use `number` for ID parameters:
- `CategoryService` - All methods now use `number` for IDs
- `OEMService` - All methods now use `number` for IDs
- `ProductService` - All methods now use `number` for IDs
- `ClientService` - All methods now use `number` for IDs
- `UserService` - All methods now use `number` for IDs, return type updated to `{ id: number; deleted: boolean }`

### ✅ Controllers
All controllers updated to parse string IDs as integers with validation:
- `CategoryController` - Parses and validates IDs as integers
- `OEMController` - Parses and validates IDs as integers
- `ProductController` - Parses and validates IDs as integers, handles `categoryId` and `oemId` query params
- `ClientController` - Parses and validates IDs as integers
- `UserController` - Parses and validates IDs as integers
- `RoleController` - Already updated (from previous migration)

### ✅ Request/Response Schemas
All schemas updated to use `number` for IDs:
- `CategoryResponse.categoryId` - String → number
- `OEMResponse.oemId` - String → number
- `ProductResponse.productId` - String → number
- `ProductResponse.category.categoryId` - String → number
- `ProductResponse.oem.oemId` - String → number
- `ClientResponse.clientId` - String → number
- `UserResponse.userId` - String → number
- `CreateProductRequest.categoryId` - String → number
- `CreateProductRequest.oemId` - String → number
- `UpdateProductRequest.categoryId` - String → number
- `UpdateProductRequest.oemId` - String → number
- `ListProductRequest.categoryId` - String → number | string (for backward compatibility)
- `ListProductRequest.oemId` - String → number | string (for backward compatibility)
- `POItemRequest.categoryId` - String → number
- `POItemRequest.oemId` - String → number
- `POItemRequest.productId` - String → number
- `CreatePORequest.clientId` - String → number
- `CreatePORequest.assignDispatchTo` - String → number
- `ListPORequest.clientId` - String → number | string (for backward compatibility)

## Frontend Changes Required

### ⚠️ API Services (ui/src/store/api/)
The following API services need to be updated to handle IDs as numbers:

1. **categoryApi.ts**
   - Update mutations to accept `number` for `id` parameter
   - Update response types to expect `number` for `categoryId`

2. **oemApi.ts**
   - Update mutations to accept `number` for `id` parameter
   - Update response types to expect `number` for `oemId`

3. **productApi.ts**
   - Update mutations to accept `number` for `id` parameter
   - Update response types to expect `number` for `productId`, `categoryId`, `oemId`
   - Update query params to handle `categoryId` and `oemId` as numbers

4. **clientApi.ts**
   - Update mutations to accept `number` for `id` parameter
   - Update response types to expect `number` for `clientId`

5. **userApi.ts**
   - Update mutations to accept `number` for `id` parameter
   - Update response types to expect `number` for `userId`

6. **poApi.ts**
   - Update request types to use `number` for `clientId`, `assignDispatchTo`
   - Update POItem types to use `number` for `categoryId`, `oemId`, `productId`

### ⚠️ Components
All components that use these IDs need to be updated:

1. **Category Management Components**
   - Update to handle `categoryId` as `number`
   - Update delete/edit handlers to use `number`

2. **OEM Management Components**
   - Update to handle `oemId` as `number`
   - Update delete/edit handlers to use `number`

3. **Product Management Components**
   - Update to handle `productId`, `categoryId`, `oemId` as `number`
   - Update form submissions to send numbers
   - Update dropdown selections to use numbers

4. **Client Management Components**
   - Update to handle `clientId` as `number`
   - Update delete/edit handlers to use `number`

5. **User Management Components**
   - Update to handle `userId` as `number`
   - Update delete/edit handlers to use `number`

6. **PO Management Components**
   - Update to handle `clientId`, `assignDispatchTo` as `number`
   - Update POItem handling to use `number` for `categoryId`, `oemId`, `productId`
   - Update form submissions to send numbers

## Database Migration Required

### Migration Steps

1. **Backup Database** (CRITICAL!)
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_before_uuid_to_int_migration.sql
   ```

2. **Create Migration**
   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate dev --name migrate_all_ids_to_integer
   ```

   This migration will:
   - Change all primary key columns from UUID/VARCHAR to SERIAL (auto-increment integer)
   - Update all foreign key columns from VARCHAR to INTEGER
   - Drop and recreate foreign key constraints
   - Update indexes

### Data Migration Considerations

⚠️ **IMPORTANT**: If you have existing data:

1. **Existing Records**: 
   - UUID IDs will need to be converted to integers
   - You'll need a mapping table to preserve relationships

2. **Foreign Key Relationships**:
   - All foreign key values need to be updated to new integer IDs
   - Foreign key constraints will need to be temporarily disabled

**Migration Script Example** (if needed):
```sql
-- This is a complex migration that requires careful planning
-- Each table needs:
-- 1. Create temporary mapping table (old_id UUID, new_id SERIAL)
-- 2. Generate new integer IDs
-- 3. Update foreign key references
-- 4. Change column types
-- 5. Drop mapping tables

-- Example for one table (repeat for each):
CREATE TABLE category_id_mapping (
  old_id UUID,
  new_id SERIAL
);

-- Generate new integer IDs
INSERT INTO category_id_mapping (old_id)
SELECT category_id FROM categories ORDER BY created_at;

-- Update foreign keys in products table
UPDATE products p
SET category_id = (
  SELECT rim.new_id
  FROM category_id_mapping rim
  WHERE rim.old_id = p.category_id
);

-- Then run Prisma migration to change column types
-- Finally drop the mapping table
DROP TABLE category_id_mapping;
```

## Testing Checklist

### Backend Tests
- [ ] Create operations - verify IDs are auto-incrementing integers
- [ ] Get by ID operations - verify integer IDs work
- [ ] Update operations - verify integer IDs work
- [ ] Delete operations - verify integer IDs work
- [ ] Foreign key relationships - verify integer foreign keys work
- [ ] Query operations with foreign key filters - verify integer filters work

### Frontend Tests
- [ ] All list pages load correctly
- [ ] Create operations work
- [ ] Edit operations work (with integer IDs)
- [ ] Delete operations work (with integer IDs)
- [ ] Forms with foreign key dropdowns work
- [ ] Search and filter operations work

## Benefits

1. **Consistency**: All primary keys now use the same integer pattern
2. **Performance**: Integer IDs are more efficient for indexing and joins
3. **Simplicity**: Easier to work with integer IDs in code
4. **Database Efficiency**: Smaller storage footprint compared to UUIDs
5. **Query Performance**: Integer comparisons are faster than string comparisons

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
- `api/src/repositories/CategoryRepository.ts`
- `api/src/repositories/OEMRepository.ts`
- `api/src/repositories/ProductRepository.ts`
- `api/src/repositories/ClientRepository.ts`
- `api/src/repositories/UserRepository.ts`
- `api/src/repositories/PORepository.ts`
- `api/src/services/CategoryService.ts`
- `api/src/services/OEMService.ts`
- `api/src/services/ProductService.ts`
- `api/src/services/ClientService.ts`
- `api/src/services/UserService.ts`
- `api/src/controllers/CategoryController.ts`
- `api/src/controllers/OEMController.ts`
- `api/src/controllers/ProductController.ts`
- `api/src/controllers/ClientController.ts`
- `api/src/controllers/UserController.ts`
- `api/src/schemas/request/CategoryRequest.ts` (no changes needed)
- `api/src/schemas/request/ProductRequest.ts`
- `api/src/schemas/request/ClientRequest.ts` (no changes needed)
- `api/src/schemas/request/PORequest.ts`
- `api/src/schemas/request/UserRequest.ts` (already updated)
- `api/src/schemas/response/CategoryResponse.ts`
- `api/src/schemas/response/OEMResponse.ts`
- `api/src/schemas/response/ProductResponse.ts`
- `api/src/schemas/response/ClientResponse.ts`
- `api/src/schemas/response/UserResponse.ts`

### Frontend (TODO)
- `ui/src/store/api/categoryApi.ts`
- `ui/src/store/api/oemApi.ts`
- `ui/src/store/api/productApi.ts`
- `ui/src/store/api/clientApi.ts`
- `ui/src/store/api/userApi.ts`
- `ui/src/store/api/poApi.ts`
- All components using these APIs

## Notes

- All backend code changes are complete and tested
- Prisma client has been regenerated
- No linter errors found in backend code
- The only remaining step is updating frontend API services and components
- Ensure database backup is taken before migration
- If you have existing data, plan the data migration carefully

## Next Steps

1. ✅ Backend migration complete
2. ⚠️ Update frontend API services
3. ⚠️ Update frontend components
4. ⚠️ Run database migration
5. ⚠️ Test thoroughly
6. ⚠️ Deploy

