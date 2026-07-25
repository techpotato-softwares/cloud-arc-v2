# Dynamic Search Implementation Guide

## Overview

This document describes the implementation of **dynamic search functionality** for all `getAll` APIs using `searchKey` and `searchTerm` parameters. This approach allows users to search on any specific field/column dynamically.

## Search Parameters

### Request Parameters

- **`searchKey`** (string, optional): The field/column name to search in
- **`searchTerm`** (string, optional): The value to search for

### Behavior

- **Case-insensitive**: All searches are case-insensitive
- **Partial matching**: Uses "contains" logic (not exact match)
- **Field validation**: Only allowed fields can be searched (security)
- **Optional**: Both parameters are optional; if not provided, no search filtering is applied
- **Default field**: If `searchTerm` is provided without `searchKey`, a default field is used automatically

## Default Search Fields

When `searchTerm` is provided but `searchKey` is not, the API automatically uses a default search field:

| API | Default Search Field |
|-----|---------------------|
| **User** | `username` |
| **Client** | `clientName` |
| **PO** | `poId` |
| **Product** | `productName` |
| **Category** | `categoryName` |
| **OEM** | `oemName` |
| **Role** | `roleName` |
| **Permission** | `permissionName` |

### Default Field Behavior

- **`searchTerm` only**: Uses default field (e.g., `username` for User API)
- **`searchKey` + `searchTerm`**: Uses specified field (overrides default)
- **Neither provided**: No search applied (normal list)

## API Usage Examples

### User API Examples

```bash
# Simple search - uses default field (username)
GET /api/user?searchTerm=john&page=1&limit=20

# Explicit field search - overrides default
GET /api/user?searchKey=email&searchTerm=john@gmail.com&page=1&limit=20

# Search with other filters (uses default field)
GET /api/user?searchTerm=admin&isActive=true&page=1&limit=20

# Without search (backward compatible)
GET /api/user?page=1&limit=20
```

### Client API Examples

```bash
# Simple search - uses default field (clientName)
GET /api/client?searchTerm=acme&page=1&limit=20

# Explicit field search (same as default in this case)
GET /api/client?searchKey=clientName&searchTerm=acme&page=1&limit=20
```

## Implementation Pattern

### Step 1: Update Request Schema

Add `searchKey` and `searchTerm` to the list request interface:

```typescript
// api/src/schemas/request/UserRequest.ts
export interface ListUserRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  // ... existing filters
  searchKey?: string; // NEW: Field name to search
  searchTerm?: string; // NEW: Value to search for
}
```

### Step 2: Define Allowed Search Fields

Create a constant array of allowed searchable fields for security:

```typescript
// api/src/repositories/UserRepository.ts

// Allowed searchable fields for User model
const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;

type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'username';
```

### Step 3: Update Controller

Add query parameters and validate:

```typescript
// api/src/controllers/UserController.ts
@Get('/')
async getAll(
  @Query('page') page?: string,
  @Query('limit') limit?: string,
  @Query('sortBy') sortBy?: string,
  @Query('sortOrder') sortOrder?: string,
  @Query('searchKey') searchKey?: string,    // NEW
  @Query('searchTerm') searchTerm?: string,    // NEW
  // ... other existing params
) {
  try {
    const result = await this.userService.getAllUsers({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sortBy: sortBy || 'createdAt',
      sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
      searchKey: searchKey || undefined,        // NEW
      searchTerm: searchTerm || undefined,      // NEW
      // ... other existing params
    });
    return createSuccessResponse(result.data, 200, result.pagination);
  } catch (err: unknown) {
    return createErrorResponse(err as Error);
  }
}
```

### Step 4: Update Repository with Security Validation

Implement search with field validation:

```typescript
// api/src/repositories/UserRepository.ts

// Allowed searchable fields
const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

@injectable()
export class UserRepository implements IUserRepository {
  // ... existing code

  /**
   * Validate if the search field is allowed
   */
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(params?: ListUserRequest): Promise<{ rows: User[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchKey,
      searchTerm,
      // ... other existing params
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // Dynamic search implementation with default field
    if (searchTerm) {
      // If searchKey is provided, use it; otherwise use default
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;

      // Security: Validate searchKey is in allowed list
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(', ')}`
        );
      }

      // Build dynamic search condition
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: 'insensitive',
      };
    }

    // ... existing filter logic
    // ... existing orderBy logic

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { rows, count };
  }
}
```

## Searchable Fields by Entity

### User (`/api/user`)

- `username`
- `email`

### Client (`/api/client`)

- `clientName`

### Purchase Order (`/api/po`)

- `poId`
- `clientPoNo`
- `osgPiNo`
- `poStatus`

### Product (`/api/product`)

- `productName`

### Category (`/api/category`)

- `categoryName`

### OEM (`/api/oem`)

- `oemName`

### Role (`/api/role`)

- `roleName`

### Permission (`/api/permission`)

- `permissionName`

## Security Considerations

### ⚠️ Critical: Field Name Validation

**NEVER** allow arbitrary field names without validation. This prevents:

- SQL injection-like attacks
- Access to sensitive fields (passwords, tokens)
- Performance issues from searching unindexed fields
- Database errors from invalid field names

### Implementation Pattern

```typescript
// ✅ GOOD: Whitelist approach
const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;

if (!ALLOWED_SEARCH_FIELDS.includes(searchKey)) {
  throw new Error('Invalid search field');
}

// ❌ BAD: No validation
where[searchKey] = { contains: searchTerm }; // DANGEROUS!
```

### Best Practices

1. **Whitelist Only**: Only allow explicitly defined fields
2. **Type Safety**: Use TypeScript const assertions and type guards
3. **Error Messages**: Provide clear error messages with allowed fields
4. **Documentation**: Document all allowed search fields in API docs
5. **Indexes**: Ensure searchable fields have database indexes

## Enhanced Implementation (Recommended)

### Option 1: Reusable Search Helper

Create a shared utility for search validation:

```typescript
// api/src/utils/searchHelper.ts

export class SearchHelper {
  /**
   * Validate and build Prisma search condition
   */
  static buildSearchCondition<T extends string>(
    searchKey: string | undefined,
    searchTerm: string | undefined,
    allowedFields: readonly T[]
  ): Record<string, any> | undefined {
    if (!searchKey || !searchTerm) {
      return undefined;
    }

    // Validate field is allowed
    if (!allowedFields.includes(searchKey as T)) {
      throw new Error(
        `Invalid search field: ${searchKey}. Allowed fields: ${allowedFields.join(', ')}`
      );
    }

    // Build Prisma search condition
    return {
      [searchKey]: {
        contains: searchTerm,
        mode: 'insensitive',
      },
    };
  }
}
```

**Usage in Repository:**

```typescript
import { SearchHelper } from '../utils/searchHelper';

const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;

async findAll(params?: ListUserRequest) {
  const { searchKey, searchTerm, ... } = params || {};

  const where: Prisma.UserWhereInput = {
    ...SearchHelper.buildSearchCondition(searchKey, searchTerm, ALLOWED_SEARCH_FIELDS),
    // ... other filters
  };
}
```

### Option 2: Hybrid Approach (Recommended)

Support both dynamic search AND general search:

```typescript
export interface ListUserRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  search?: string; // General search (searches all fields with OR)
  searchKey?: string; // Specific field search
  searchTerm?: string; // Value for specific field search
}
```

**Repository Logic:**

```typescript
const where: Prisma.UserWhereInput = {};

// Priority: searchKey + searchTerm > general search
if (searchKey && searchTerm) {
  // Specific field search
  if (!this.isValidSearchField(searchKey)) {
    throw new Error(`Invalid search field: ${searchKey}`);
  }
  where[searchKey] = {
    contains: searchTerm,
    mode: 'insensitive',
  };
} else if (search) {
  // General search across all fields (OR logic)
  where.OR = [
    { username: { contains: search, mode: 'insensitive' } },
    { email: { contains: search, mode: 'insensitive' } },
  ];
}
```

**Benefits:**

- Simple use case: Use `search` parameter
- Advanced use case: Use `searchKey` + `searchTerm`
- Backward compatible
- More user-friendly

## Frontend Integration

### RTK Query Usage

```typescript
// Simple search - uses default field (username)
const { data } = useGetUsersQuery({
  page: 1,
  limit: 20,
  searchTerm: 'john',
});

// Explicit field search
const { data } = useGetUsersQuery({
  page: 1,
  limit: 20,
  searchKey: 'email',
  searchTerm: 'john@gmail.com',
});

// With other filters (uses default field)
const { data } = useGetUsersQuery({
  page: 1,
  limit: 20,
  searchTerm: 'admin',
  isActive: true,
});
```

### UI Component Example

```typescript
import { Select, Input, Button } from 'antd';
import { useState } from 'react';

const UserSearchComponent = () => {
  const [searchKey, setSearchKey] = useState<string>('username');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data, isLoading } = useGetUsersQuery({
    page: 1,
    limit: 20,
    searchKey: searchTerm ? searchKey : undefined,
    searchTerm: searchTerm || undefined,
  });

  return (
    <div style={{ marginBottom: 16 }}>
      <Select
        value={searchKey}
        onChange={setSearchKey}
        style={{ width: 150, marginRight: 8 }}
      >
        <Select.Option value="username">Username</Select.Option>
        <Select.Option value="email">Email</Select.Option>
      </Select>
      <Input.Search
        placeholder={`Search by ${searchKey}...`}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSearch={(value) => setSearchTerm(value)}
        allowClear
        style={{ width: 300 }}
      />
    </div>
  );
};
```

## Testing

### Unit Tests

```typescript
describe('UserRepository - Dynamic Search', () => {
  it('should search by username', async () => {
    const result = await repository.findAll({
      searchKey: 'username',
      searchTerm: 'john',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].username).toContain('john');
  });

  it('should search by email', async () => {
    const result = await repository.findAll({
      searchKey: 'email',
      searchTerm: 'john@example.com',
    });
    expect(result.rows[0].email).toContain('john@example.com');
  });

  it('should be case-insensitive', async () => {
    const result1 = await repository.findAll({
      searchKey: 'username',
      searchTerm: 'JOHN',
    });
    const result2 = await repository.findAll({
      searchKey: 'username',
      searchTerm: 'john',
    });
    expect(result1.rows).toEqual(result2.rows);
  });

  it('should throw error for invalid search field', async () => {
    await expect(
      repository.findAll({
        searchKey: 'password', // Invalid field
        searchTerm: 'test',
      })
    ).rejects.toThrow('Invalid search field');
  });

  it('should work with other filters', async () => {
    const result = await repository.findAll({
      searchKey: 'username',
      searchTerm: 'admin',
      isActive: true,
    });
    // Should return active users with username containing 'admin'
  });
});
```

### Integration Tests

```typescript
describe('GET /api/user - Dynamic Search', () => {
  it('should search by username', async () => {
    const response = await request(app)
      .get('/api/user')
      .query({ searchKey: 'username', searchTerm: 'john' });

    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });

  it('should return 400 for invalid search field', async () => {
    const response = await request(app)
      .get('/api/user')
      .query({ searchKey: 'invalidField', searchTerm: 'test' });

    expect(response.status).toBe(400);
  });
});
```

## Migration Checklist

For each API:

- [ ] Update `ListXRequest` interface (add `searchKey?`, `searchTerm?`)
- [ ] Define `ALLOWED_SEARCH_FIELDS` constant in repository
- [ ] Add `isValidSearchField` validation method
- [ ] Update controller to accept `searchKey` and `searchTerm` query params
- [ ] Update repository `findAll` method with search logic
- [ ] Add unit tests for search functionality
- [ ] Add integration tests
- [ ] Update API documentation
- [ ] (Optional) Update frontend components

## Performance Optimization

1. **Database Indexes**: Ensure all searchable fields have indexes

   ```prisma
   model User {
     username String @unique
     email    String @unique

     @@index([username])
     @@index([email])
   }
   ```

2. **Minimum Search Length**: Consider requiring minimum 2-3 characters

   ```typescript
   if (searchTerm && searchTerm.length < 2) {
     throw new Error('Search term must be at least 2 characters');
   }
   ```

3. **Pagination**: Always use pagination to limit results

## Comparison: Dynamic vs General Search

| Feature             | Dynamic Search (searchKey + searchTerm) | General Search (search)               |
| ------------------- | --------------------------------------- | ------------------------------------- |
| **Flexibility**     | ✅ High - user chooses field            | ⚠️ Medium - searches all fields       |
| **Performance**     | ✅ Better - single field query          | ⚠️ Slower - OR across multiple fields |
| **User Experience** | ⚠️ Requires field knowledge             | ✅ Simple - one search box            |
| **Security**        | ⚠️ Needs validation                     | ✅ Safer - predefined fields          |
| **Use Case**        | Advanced users, APIs                    | General users, UI                     |

**Recommendation**: Implement **both** for maximum flexibility!

## Next Steps

1. ✅ Review this documentation
2. ✅ Choose implementation approach (dynamic only, or hybrid)
3. ✅ Implement for User API (pilot)
4. ✅ Test thoroughly
5. ✅ Apply pattern to other APIs
6. ✅ Update frontend components
7. ✅ Update API documentation
