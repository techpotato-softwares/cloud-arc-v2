# Dynamic Search Implementation - User API Example

This document shows the **exact code changes** needed to implement dynamic search for the User API. Use this as a template for other APIs.

## Files to Modify

### 1. Request Schema

**File**: `api/src/schemas/request/UserRequest.ts`

**Change**: Add `searchKey` and `searchTerm` to `ListUserRequest`

```typescript
export interface ListUserRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  userName?: string;
  email?: string;
  role?: string;
  status?: string;
  searchKey?: string; // ✅ ADD THIS
  searchTerm?: string; // ✅ ADD THIS
}
```

---

### 2. Repository - Add Search Validation

**File**: `api/src/repositories/UserRepository.ts`

**Changes**:

1. Add allowed search fields constant
2. Add validation method
3. Update `findAll` method

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { PrismaClient, User, Prisma } from '@prisma/client';
import {
  CreateUserRequest,
  UpdateUserRequest,
  ListUserRequest,
} from '../schemas/request/UserRequest';

// ✅ ADD THIS: Allowed searchable fields for User model
const ALLOWED_SEARCH_FIELDS = ['username', 'email'] as const;
type AllowedSearchField = (typeof ALLOWED_SEARCH_FIELDS)[number];

// ✅ ADD THIS: Default search field when searchKey is not provided
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'username';

export interface IUserRepository {
  findAll(params?: ListUserRequest): Promise<{ rows: User[]; count: number }>;
  findById(id: string): Promise<User | null>;
  update(id: string, data: UpdateUserRequest): Promise<User>;
  delete(id: string): Promise<void>;
  create(data: CreateUserRequest): Promise<User>;
}

@injectable()
export class UserRepository implements IUserRepository {
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  // ✅ ADD THIS: Validate if search field is allowed
  private isValidSearchField(field: string): field is AllowedSearchField {
    return ALLOWED_SEARCH_FIELDS.includes(field as AllowedSearchField);
  }

  async findAll(params?: ListUserRequest): Promise<{ rows: User[]; count: number }> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
      searchKey, // ✅ ADD THIS
      searchTerm, // ✅ ADD THIS
      // ... other existing params
    } = params || {};
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {};

    // ✅ ADD THIS BLOCK: Dynamic search implementation with default field
    if (searchTerm) {
      // If searchKey is provided, use it; otherwise use default
      const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;

      // Security: Validate searchKey is in allowed list
      if (!this.isValidSearchField(fieldToSearch)) {
        throw new Error(
          `Invalid search field: ${fieldToSearch}. Allowed fields: ${ALLOWED_SEARCH_FIELDS.join(', ')}`
        );
      }

      // Build dynamic search condition (case-insensitive)
      where[fieldToSearch] = {
        contains: searchTerm,
        mode: 'insensitive',
      };
    }

    // ... existing filter logic (userName, email, role, status, etc.)
    // Keep existing filters - they work alongside search

    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'username') {
      orderBy.username = sortOrder === 'ASC' ? 'asc' : 'desc';
    } else if (sortBy === 'email') {
      orderBy.email = sortOrder === 'ASC' ? 'asc' : 'desc';
    }

    const [rows, count] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          role: true,
          userRoles: {
            include: {
              role: true,
            },
          },
        } as any,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { rows, count };
  }

  // ... rest of the methods remain unchanged
}
```

---

### 3. Controller

**File**: `api/src/controllers/UserController.ts`

**Change**: Add `searchKey` and `searchTerm` query parameters

```typescript
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  createSuccessResponse,
  createErrorResponse,
} from '@arcforge/shared';

import { TYPES } from '../types/types';
import { IUserService } from '../services/UserService';
import { CreateUserRequest, UpdateUserRequest } from '../schemas/request/UserRequest';

@Controller({ path: '/api/user', lambdaName: 'userManagement' })
@injectable()
export class UserController implements IUserController {
  constructor(
    @inject(TYPES.UserService)
    private userService: IUserService
  ) {}

  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('userName') userName?: string,
    @Query('email') email?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('searchKey') searchKey?: string, // ✅ ADD THIS
    @Query('searchTerm') searchTerm?: string // ✅ ADD THIS
  ): Promise<APIGatewayProxyResult> {
    try {
      const result = await this.userService.getAllUsers({
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder as 'ASC' | 'DESC') || 'DESC',
        userName: userName || undefined,
        email: email || undefined,
        role: role || undefined,
        status: status || undefined,
        searchKey: searchKey || undefined, // ✅ ADD THIS
        searchTerm: searchTerm || undefined, // ✅ ADD THIS
      });
      return createSuccessResponse(result.data, 200, result.pagination);
    } catch (err: unknown) {
      return createErrorResponse(err as Error);
    }
  }

  // ... rest of the methods remain unchanged
}
```

---

### 4. Service

**File**: `api/src/services/UserService.ts`

**Change**: No changes needed! Service already passes params through to repository.

---

### 5. Frontend API (Optional)

**File**: `ui/src/store/api/userApi.ts`

**Change**: No changes needed! The `searchKey` and `searchTerm` parameters will automatically be included if provided.

**Usage Examples**:

```typescript
// Simple search - uses default field (username)
const { data, isLoading } = useGetUsersQuery({
  page: 1,
  limit: 20,
  searchTerm: 'john',
});

// Explicit field search
const { data, isLoading } = useGetUsersQuery({
  page: 1,
  limit: 20,
  searchKey: 'email',
  searchTerm: 'john@gmail.com',
});
```

---

## Default Field Behavior

When `searchTerm` is provided without `searchKey`, the API automatically uses the default search field (`username` for User API).

### Examples

```bash
# Uses default field (username) - Simple and user-friendly
GET /api/user?searchTerm=john

# Explicitly specify field - Overrides default
GET /api/user?searchKey=email&searchTerm=john@gmail.com
```

Both queries work, but the first one is simpler for most use cases.

### Benefits

- ✅ **Simpler API**: Just provide `searchTerm` for common searches
- ✅ **Better UX**: No need to know field names for basic search
- ✅ **Flexible**: Can still override with `searchKey` when needed
- ✅ **Backward Compatible**: Existing code with `searchKey` still works

---

## Testing

### Manual Testing with cURL

```bash
# Search by username (uses default field)
curl "http://localhost:3000/api/user?searchTerm=john&page=1&limit=20"

# Search by email (explicit field)
curl "http://localhost:3000/api/user?searchKey=email&searchTerm=john@gmail.com&page=1&limit=20"

# Search with other filters (uses default field)
curl "http://localhost:3000/api/user?searchTerm=admin&isActive=true&page=1&limit=20"

# Test invalid search field (should return error)
curl "http://localhost:3000/api/user?searchKey=password&searchTerm=test"

# Test without search (backward compatible)
curl "http://localhost:3000/api/user?page=1&limit=20"
```

### Expected Results

1. **Valid search with default field**: Returns users matching the search criteria (searches `username` by default)
2. **Valid search with explicit field**: Returns users matching the specified field
3. **Invalid searchKey**: Returns 400 error with message about allowed fields
4. **No search params**: Returns all users (backward compatible)
5. **Case-insensitive**: `searchTerm=JOHN` and `searchTerm=john` return same results
6. **Partial match**: `searchTerm=jo` matches "john", "joe", etc.

---

## Frontend Component Examples

### Simple Search (Uses Default Field)

```typescript
import { Input, Table } from 'antd';
import { useState } from 'react';
import { useGetUsersQuery } from '../store/api/userApi';

const UserManagement = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data, isLoading } = useGetUsersQuery({
    page: currentPage,
    limit: pageSize,
    searchTerm: searchTerm || undefined, // Uses default field (username)
  });

  return (
    <div>
      {/* Simple Search - uses default field */}
      <Input.Search
        placeholder="Search users by username..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onSearch={(value) => {
          setSearchTerm(value);
          setCurrentPage(1);
        }}
        allowClear
        style={{ width: 300, marginBottom: 16 }}
      />

      {/* Table */}
      <Table
        dataSource={data?.data || []}
        loading={isLoading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: data?.pagination?.total || 0,
          onChange: (page) => setCurrentPage(page),
        }}
        columns={[
          { title: 'Username', dataIndex: 'username', key: 'username' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
        ]}
      />
    </div>
  );
};
```

### Advanced Search (With Field Selection)

```typescript
import { Select, Input, Table } from 'antd';
import { useState } from 'react';
import { useGetUsersQuery } from '../store/api/userApi';

const UserManagement = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchKey, setSearchKey] = useState<string>('username');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const { data, isLoading } = useGetUsersQuery({
    page: currentPage,
    limit: pageSize,
    searchKey: searchTerm ? searchKey : undefined,
    searchTerm: searchTerm || undefined,
  });

  return (
    <div>
      {/* Search Controls */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Select
          value={searchKey}
          onChange={setSearchKey}
          style={{ width: 150 }}
        >
          <Select.Option value="username">Username</Select.Option>
          <Select.Option value="email">Email</Select.Option>
        </Select>
        <Input.Search
          placeholder={`Search by ${searchKey}...`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onSearch={(value) => {
            setSearchTerm(value);
            setCurrentPage(1); // Reset to first page on new search
          }}
          allowClear
          style={{ width: 300 }}
        />
      </div>

      {/* Table */}
      <Table
        dataSource={data?.data || []}
        loading={isLoading}
        pagination={{
          current: currentPage,
          pageSize: pageSize,
          total: data?.pagination?.total || 0,
          onChange: (page) => setCurrentPage(page),
        }}
        columns={[
          { title: 'Username', dataIndex: 'username', key: 'username' },
          { title: 'Email', dataIndex: 'email', key: 'email' },
          // ... other columns
        ]}
      />
    </div>
  );
};
```

---

## Key Points

1. ✅ **Security**: Only allowed fields can be searched (whitelist approach)
2. ✅ **Case-Insensitive**: All searches are case-insensitive
3. ✅ **Backward Compatible**: Works without search parameters
4. ✅ **Flexible**: Can combine with other filters
5. ✅ **Type Safe**: Uses TypeScript for field validation
6. ✅ **Default Field**: Uses `username` as default when only `searchTerm` is provided
7. ✅ **User-Friendly**: Simple API - just provide `searchTerm` for most use cases

---

## Error Handling

### Invalid Search Field

If user provides invalid `searchKey`:

```typescript
// Request
GET /api/user?searchKey=password&searchTerm=test

// Response (400 Bad Request)
{
  "success": false,
  "error": "Invalid search field: password. Allowed fields: username, email"
}
```

### Missing Search Term

If `searchKey` is provided but `searchTerm` is missing:

```typescript
// Request
GET /api/user?searchKey=username

// Behavior: searchKey is ignored, returns all users (or can throw error - your choice)
```

---

## Next Steps

1. ✅ Implement for User API using this example
2. ✅ Test thoroughly
3. ✅ Apply same pattern to other APIs
4. ✅ Update API documentation
5. ✅ Add frontend search UI components
