# Dynamic Search - Quick Reference Guide

## 📚 Documentation Files

1. **[DYNAMIC_SEARCH_IMPLEMENTATION.md](./DYNAMIC_SEARCH_IMPLEMENTATION.md)** - Comprehensive guide
2. **[DYNAMIC_SEARCH_EXAMPLE_USER_API.md](./DYNAMIC_SEARCH_EXAMPLE_USER_API.md)** - **START HERE!** Exact code example

## 🚀 Quick Implementation (3 Steps)

### Step 1: Update Request Schema

```typescript
export interface ListXRequest {
  // ... existing fields
  searchKey?: string; // ADD THIS
  searchTerm?: string; // ADD THIS
}
```

### Step 2: Update Repository

```typescript
// Define allowed fields
const ALLOWED_SEARCH_FIELDS = ['field1', 'field2'] as const;
type AllowedSearchField = typeof ALLOWED_SEARCH_FIELDS[number];

// Define default search field
const DEFAULT_SEARCH_FIELD: AllowedSearchField = 'field1';

// In findAll method
if (searchTerm) {
  // Use searchKey if provided, otherwise use default
  const fieldToSearch = searchKey || DEFAULT_SEARCH_FIELD;
  
  if (!ALLOWED_SEARCH_FIELDS.includes(fieldToSearch)) {
    throw new Error(`Invalid search field: ${fieldToSearch}`);
  }
  where[fieldToSearch] = {
    contains: searchTerm,
    mode: 'insensitive',
  };
}
```

### Step 3: Update Controller

```typescript
@Get('/')
async getAll(
  // ... existing params
  @Query('searchKey') searchKey?: string,    // ADD THIS
  @Query('searchTerm') searchTerm?: string,  // ADD THIS
) {
  // Pass to service
}
```

## 📋 Searchable Fields by API

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

## 📋 Default Search Fields

When `searchTerm` is provided without `searchKey`, these default fields are used:

| API            | Default Field   |
| -------------- | --------------- |
| **User**       | `username`      |
| **Client**     | `clientName`    |
| **PO**         | `poId`          |
| **Product**    | `productName`   |
| **Category**   | `categoryName`  |
| **OEM**        | `oemName`      |
| **Role**       | `roleName`      |
| **Permission** | `permissionName` |

**Note**: You can still override the default by providing `searchKey` explicitly.

## 🔒 Security Checklist

- [ ] Define `ALLOWED_SEARCH_FIELDS` constant
- [ ] Validate `searchKey` against allowed fields
- [ ] Throw error for invalid fields
- [ ] Never allow arbitrary field names
- [ ] Document allowed fields in API docs

## 📖 Usage Examples

### API Call

```bash
# Simple search - uses default field (username)
GET /api/user?searchTerm=john&page=1&limit=20

# Explicit field search - overrides default
GET /api/user?searchKey=email&searchTerm=john@gmail.com&page=1&limit=20
```

### Frontend RTK Query

```typescript
// Simple search - uses default field (username)
const { data } = useGetUsersQuery({
  searchTerm: 'john',
  page: 1,
  limit: 20,
});

// Explicit field search
const { data } = useGetUsersQuery({
  searchKey: 'email',
  searchTerm: 'john@gmail.com',
  page: 1,
  limit: 20,
});
```

## ✅ Implementation Checklist

For each API:

- [ ] Add `searchKey?` and `searchTerm?` to request schema
- [ ] Define `ALLOWED_SEARCH_FIELDS` in repository
- [ ] Add validation in repository `findAll` method
- [ ] Add query parameters to controller
- [ ] Test with valid fields
- [ ] Test with invalid fields (should error)
- [ ] Test case-insensitive search
- [ ] Test with other filters
- [ ] Update API documentation

## 🎯 Key Points

- ✅ **Security First**: Always validate `searchKey`
- ✅ **Case-Insensitive**: All searches use `mode: 'insensitive'`
- ✅ **Backward Compatible**: Works without search params
- ✅ **Type Safe**: Use TypeScript const assertions

## 🐛 Common Issues

**Issue**: "Invalid search field" error

- **Solution**: Check `searchKey` is in `ALLOWED_SEARCH_FIELDS`

**Issue**: Search not working

- **Solution**: Ensure `searchTerm` is provided (`searchKey` is optional and will use default if not provided)

**Issue**: Case-sensitive results

- **Solution**: Verify `mode: 'insensitive'` is set in Prisma query

## 💡 Better Solution: Hybrid Approach

Consider implementing **both** dynamic search AND general search:

```typescript
// Option 1: Specific field search
GET /api/user?searchKey=username&searchTerm=john

// Option 2: General search (searches all fields)
GET /api/user?search=john
```

See [DYNAMIC_SEARCH_IMPLEMENTATION.md](./DYNAMIC_SEARCH_IMPLEMENTATION.md) for hybrid approach details.
