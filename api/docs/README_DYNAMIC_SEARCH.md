# Dynamic Search Implementation - Overview

## 📖 Documentation Structure

This directory contains comprehensive documentation for implementing dynamic search functionality across all `getAll` APIs.

### Documentation Files

1. **[DYNAMIC_SEARCH_IMPLEMENTATION.md](./DYNAMIC_SEARCH_IMPLEMENTATION.md)**
   - Complete implementation guide
   - Security considerations
   - Searchable fields for each API
   - Performance optimization
   - Hybrid approach (recommended)

2. **[DYNAMIC_SEARCH_EXAMPLE_USER_API.md](./DYNAMIC_SEARCH_EXAMPLE_USER_API.md)** ⭐ **START HERE**
   - Exact code changes for User API
   - Copy-paste ready code snippets
   - Step-by-step implementation
   - Testing examples

3. **[DYNAMIC_SEARCH_QUICK_REFERENCE.md](./DYNAMIC_SEARCH_QUICK_REFERENCE.md)**
   - Quick reference guide
   - Implementation checklist
   - Common issues and solutions

## 🎯 What is Dynamic Search?

Dynamic search allows users to search on **any specific field/column** using two parameters:

- **`searchKey`**: The field name to search in (e.g., `username`, `email`)
- **`searchTerm`**: The value to search for (e.g., `john`, `john@gmail.com`)

### Example Usage

```bash
# Simple search - uses default field (username)
GET /api/user?searchTerm=john

# Explicit field search
GET /api/user?searchKey=email&searchTerm=john@gmail.com

# Search with other filters (uses default field)
GET /api/user?searchTerm=admin&isActive=true
```

**Note**: If `searchTerm` is provided without `searchKey`, the API automatically uses a default search field (e.g., `username` for User API).

## 🔒 Security Features

- ✅ **Field Validation**: Only allowed fields can be searched
- ✅ **Whitelist Approach**: Prevents SQL injection-like attacks
- ✅ **Type Safety**: TypeScript ensures type safety
- ✅ **Error Messages**: Clear error messages for invalid fields

## 🚀 Quick Start

### 1. Read the Example

Start with **[DYNAMIC_SEARCH_EXAMPLE_USER_API.md](./DYNAMIC_SEARCH_EXAMPLE_USER_API.md)** to see exact code changes.

### 2. Implement for One API

Follow the example to implement search for User API (pilot).

### 3. Apply to Other APIs

Use the same pattern for other APIs.

## 📋 Implementation Pattern

### Request Schema

```typescript
export interface ListXRequest {
  // ... existing fields
  searchKey?: string;
  searchTerm?: string;
}
```

### Repository

```typescript
const ALLOWED_SEARCH_FIELDS = ['field1', 'field2'] as const;
const DEFAULT_SEARCH_FIELD = 'field1';

if (searchTerm) {
  const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;
  if (!ALLOWED_SEARCH_FIELDS.includes(fieldToSearch)) {
    throw new Error('Invalid search field');
  }
  where[fieldToSearch] = {
    contains: searchTerm,
    mode: 'insensitive',
  };
}
```

### Controller

```typescript
@Get('/')
async getAll(
  @Query('searchKey') searchKey?: string,
  @Query('searchTerm') searchTerm?: string,
) {
  // Pass to service
}
```

## 💡 Recommended: Hybrid Approach

Consider implementing **both** approaches for maximum flexibility:

1. **Dynamic Search** (`searchKey` + `searchTerm`): For advanced users, specific field searches
2. **General Search** (`search`): For simple use cases, searches all fields

See [DYNAMIC_SEARCH_IMPLEMENTATION.md](./DYNAMIC_SEARCH_IMPLEMENTATION.md) for details.

## 🛠️ Reusable Utility

A reusable utility helper is available at:

- **`api/src/utils/searchHelper.ts`**

Use it to avoid code duplication across repositories:

```typescript
import { SearchHelper } from '../utils/searchHelper';

const searchCondition = SearchHelper.buildSearchCondition(
  searchKey,
  searchTerm,
  ALLOWED_SEARCH_FIELDS
);

if (searchCondition) {
  Object.assign(where, searchCondition);
}
```

## 📊 Searchable Fields by API

| API            | Searchable Fields                           |
| -------------- | ------------------------------------------- |
| **User**       | `username`, `email`                         |
| **Client**     | `clientName`                                |
| **PO**         | `poId`, `clientPoNo`, `osgPiNo`, `poStatus` |
| **Product**    | `productName`                               |
| **Category**   | `categoryName`                              |
| **OEM**        | `oemName`                                   |
| **Role**       | `roleName`                                  |
| **Permission** | `permissionName`                            |

## 🔑 Default Search Fields

Each API has a default search field that is used when `searchTerm` is provided without `searchKey`:

| API            | Default Field    |
| -------------- | ---------------- |
| **User**       | `username`       |
| **Client**     | `clientName`     |
| **PO**         | `poId`           |
| **Product**    | `productName`    |
| **Category**   | `categoryName`   |
| **OEM**        | `oemName`        |
| **Role**       | `roleName`       |
| **Permission** | `permissionName` |

This makes the API more user-friendly - you can simply provide `searchTerm` for most use cases!

### Behavior

- **`searchTerm` only**: Uses default field (e.g., `username` for User API)
- **`searchKey` + `searchTerm`**: Uses specified field (overrides default)
- **Neither provided**: No search applied (normal list)

## ✅ Benefits

- ✅ **Flexible**: User chooses which field to search
- ✅ **Secure**: Field validation prevents attacks
- ✅ **Performant**: Single field queries are faster
- ✅ **Type Safe**: TypeScript ensures correctness
- ✅ **Backward Compatible**: Works without search params

## ⚠️ Important Notes

1. **Always validate `searchKey`** - Never allow arbitrary field names
2. **Use whitelist approach** - Only allow explicitly defined fields
3. **Case-insensitive** - All searches use `mode: 'insensitive'`
4. **Database indexes** - Ensure searchable fields have indexes
5. **Error handling** - Provide clear error messages

## 🧪 Testing

### Unit Tests

```typescript
it('should search by username', async () => {
  const result = await repository.findAll({
    searchKey: 'username',
    searchTerm: 'john',
  });
  expect(result.rows[0].username).toContain('john');
});

it('should throw error for invalid field', async () => {
  await expect(
    repository.findAll({
      searchKey: 'password',
      searchTerm: 'test',
    })
  ).rejects.toThrow('Invalid search field');
});
```

### Integration Tests

```typescript
it('should search by username via API', async () => {
  const response = await request(app)
    .get('/api/user')
    .query({ searchKey: 'username', searchTerm: 'john' });

  expect(response.status).toBe(200);
});
```

## 📝 Migration Checklist

For each API:

- [ ] Update request schema
- [ ] Define allowed search fields
- [ ] Add validation in repository
- [ ] Update controller
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update API documentation
- [ ] (Optional) Update frontend components

## 🔗 Related Files

- **Utility**: `api/src/utils/searchHelper.ts`
- **Example**: `api/docs/DYNAMIC_SEARCH_EXAMPLE_USER_API.md`
- **Guide**: `api/docs/DYNAMIC_SEARCH_IMPLEMENTATION.md`

## 🎓 Learning Path

1. **Read**: [DYNAMIC_SEARCH_EXAMPLE_USER_API.md](./DYNAMIC_SEARCH_EXAMPLE_USER_API.md)
2. **Understand**: [DYNAMIC_SEARCH_IMPLEMENTATION.md](./DYNAMIC_SEARCH_IMPLEMENTATION.md)
3. **Reference**: [DYNAMIC_SEARCH_QUICK_REFERENCE.md](./DYNAMIC_SEARCH_QUICK_REFERENCE.md)
4. **Implement**: Start with User API, then apply to others

## 🐛 Troubleshooting

**Issue**: "Invalid search field" error

- **Solution**: Check `searchKey` is in `ALLOWED_SEARCH_FIELDS`

**Issue**: Search not working

- **Solution**: Ensure `searchTerm` is provided (`searchKey` is optional and will use default if not provided)

**Issue**: Case-sensitive results

- **Solution**: Verify `mode: 'insensitive'` is set

## 📞 Next Steps

1. ✅ Review documentation
2. ✅ Implement for User API (pilot)
3. ✅ Test thoroughly
4. ✅ Apply pattern to other APIs
5. ✅ Update frontend components
6. ✅ Update API documentation
