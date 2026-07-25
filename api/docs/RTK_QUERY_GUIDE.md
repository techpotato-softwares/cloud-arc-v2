# RTK Query - Comprehensive Guide for Beginners

This guide is designed for developers who are new to RTK Query. It covers the fundamental concepts, terminology, and patterns you need to understand before integrating APIs into the ArcForge CloudArc application.

---

## Table of Contents

1. [What is RTK Query?](#what-is-rtk-query)
2. [Why Use RTK Query?](#why-use-rtk-query)
3. [Core Concepts](#core-concepts)
4. [Queries vs Mutations](#queries-vs-mutations)
5. [Caching and Cache Invalidation](#caching-and-cache-invalidation)
6. [Tags System](#tags-system)
7. [How RTK Query Fits with Redux](#how-rtk-query-fits-with-redux)
8. [Authentication with JWT](#authentication-with-jwt)
9. [Error Handling](#error-handling)
10. [Best Practices](#best-practices)
11. [Common Pitfalls](#common-pitfalls)
12. [Glossary](#glossary)

---

## What is RTK Query?

**RTK Query** is a powerful data fetching and caching tool built into Redux Toolkit. It simplifies the process of fetching data from APIs and managing that data in your Redux store.

Think of it as a specialized tool that handles:
- Making API calls (GET, POST, PUT, DELETE)
- Storing the response data in Redux
- Caching data to avoid unnecessary network requests
- Tracking loading and error states automatically

### Before RTK Query (Traditional Approach)

```typescript
// You had to write ALL of this manually:

// 1. Define action types
const FETCH_USERS_REQUEST = 'FETCH_USERS_REQUEST';
const FETCH_USERS_SUCCESS = 'FETCH_USERS_SUCCESS';
const FETCH_USERS_FAILURE = 'FETCH_USERS_FAILURE';

// 2. Create action creators
const fetchUsersRequest = () => ({ type: FETCH_USERS_REQUEST });
const fetchUsersSuccess = (users) => ({ type: FETCH_USERS_SUCCESS, payload: users });
const fetchUsersFailure = (error) => ({ type: FETCH_USERS_FAILURE, payload: error });

// 3. Create a thunk for async logic
const fetchUsers = () => async (dispatch) => {
  dispatch(fetchUsersRequest());
  try {
    const response = await fetch('/api/users');
    const data = await response.json();
    dispatch(fetchUsersSuccess(data));
  } catch (error) {
    dispatch(fetchUsersFailure(error.message));
  }
};

// 4. Handle all states in reducer
const usersReducer = (state = { loading: false, data: [], error: null }, action) => {
  switch (action.type) {
    case FETCH_USERS_REQUEST:
      return { ...state, loading: true, error: null };
    case FETCH_USERS_SUCCESS:
      return { ...state, loading: false, data: action.payload };
    case FETCH_USERS_FAILURE:
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};
```

### With RTK Query (Modern Approach)

```typescript
// All of the above is replaced with this:

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const api = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getUsers: builder.query({
      query: () => '/users',
    }),
  }),
});

export const { useGetUsersQuery } = api;

// In your component:
const { data, isLoading, error } = useGetUsersQuery();
```

**Result:** 90% less boilerplate code!

---

## Why Use RTK Query?

| Feature | Without RTK Query | With RTK Query |
|---------|-------------------|----------------|
| Loading states | Manual tracking | Automatic |
| Error handling | Manual try-catch | Built-in |
| Caching | Build from scratch | Automatic |
| Deduplication | Not handled | Automatic |
| Refetching | Manual implementation | Built-in hooks |
| TypeScript types | Define manually | Auto-generated |
| Optimistic updates | Complex to implement | Simple API |

### Key Benefits

1. **Automatic Caching**: Data is cached and reused, reducing unnecessary API calls
2. **Auto-generated Hooks**: `useGetPOsQuery()`, `useCreatePOMutation()` are created automatically
3. **Loading & Error States**: `isLoading`, `isError`, `isSuccess` provided out of the box
4. **Cache Invalidation**: Smart system to refetch data when needed
5. **DevTools Integration**: Full visibility in Redux DevTools
6. **TypeScript First**: Excellent type inference and type safety

---

## Core Concepts

### 1. API Slice

An **API Slice** is a centralized definition of all your API endpoints. Think of it as a "contract" that describes how to communicate with your backend.

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

// This is an API Slice
export const poApi = createApi({
  reducerPath: 'poApi',              // Unique key in Redux store
  baseQuery: fetchBaseQuery({         // Base configuration for all requests
    baseUrl: 'http://localhost:3001/api',
  }),
  tagTypes: ['PO'],                   // Tags for cache invalidation
  endpoints: (builder) => ({          // Define your endpoints here
    // ... endpoints go here
  }),
});
```

### 2. Endpoints

**Endpoints** are the individual API operations. There are two types:

- **Query**: For fetching/reading data (GET requests)
- **Mutation**: For modifying data (POST, PUT, DELETE requests)

```typescript
endpoints: (builder) => ({
  // Query endpoint - for fetching data
  getPOs: builder.query({
    query: () => '/po',
  }),
  
  // Mutation endpoint - for creating/updating/deleting data
  createPO: builder.mutation({
    query: (newPO) => ({
      url: '/po',
      method: 'POST',
      body: newPO,
    }),
  }),
}),
```

### 3. Base Query

The **baseQuery** is a function that handles the actual HTTP requests. RTK Query provides `fetchBaseQuery` which is a lightweight wrapper around `fetch`.

```typescript
baseQuery: fetchBaseQuery({
  baseUrl: 'http://localhost:3001/api',
  prepareHeaders: (headers, { getState }) => {
    // Add authentication headers
    const token = getState().auth.token;
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
}),
```

### 4. Auto-Generated Hooks

For every endpoint you define, RTK Query automatically generates React hooks:

| Endpoint Type | Endpoint Name | Generated Hook |
|---------------|---------------|----------------|
| Query | `getPOs` | `useGetPOsQuery()` |
| Query | `getPOById` | `useGetPOByIdQuery()` |
| Mutation | `createPO` | `useCreatePOMutation()` |
| Mutation | `updatePO` | `useUpdatePOMutation()` |
| Mutation | `deletePO` | `useDeletePOMutation()` |

---

## Queries vs Mutations

### Queries (Reading Data)

Use queries when you want to **fetch/read** data. Queries:
- Execute automatically when the component mounts
- Return cached data if available
- Can be configured to refetch on various triggers

```typescript
// Defining a query
getPOs: builder.query<POResponse[], ListPORequest>({
  query: (params) => ({
    url: '/po',
    params: params, // Query parameters: ?page=1&limit=10
  }),
}),

// Using the query hook
const MyComponent = () => {
  const { 
    data,           // The response data (POResponse[])
    isLoading,      // true while fetching for the first time
    isFetching,     // true while any fetch is in progress
    isSuccess,      // true if the request succeeded
    isError,        // true if the request failed
    error,          // Error object if request failed
    refetch,        // Function to manually trigger refetch
  } = useGetPOsQuery({ page: 1, limit: 10 });
  
  if (isLoading) return <Spinner />;
  if (isError) return <Error message={error.message} />;
  
  return <POList data={data} />;
};
```

### Mutations (Writing Data)

Use mutations when you want to **create, update, or delete** data. Mutations:
- Do NOT execute automatically
- Return a trigger function that you call manually
- Can invalidate cached queries to trigger refetch

```typescript
// Defining a mutation
createPO: builder.mutation<POResponse, CreatePORequest>({
  query: (newPO) => ({
    url: '/po',
    method: 'POST',
    body: newPO,
  }),
}),

// Using the mutation hook
const CreatePOForm = () => {
  const [createPO, { 
    isLoading,      // true while mutation is in progress
    isSuccess,      // true if mutation succeeded
    isError,        // true if mutation failed
    error,          // Error object if failed
    data,           // Response data if successful
    reset,          // Function to reset the mutation state
  }] = useCreatePOMutation();
  
  const handleSubmit = async (formData: CreatePORequest) => {
    try {
      // Trigger the mutation
      const result = await createPO(formData).unwrap();
      console.log('PO created:', result);
    } catch (err) {
      console.error('Failed to create PO:', err);
    }
  };
  
  return <Form onSubmit={handleSubmit} loading={isLoading} />;
};
```

### Key Differences

| Aspect | Query | Mutation |
|--------|-------|----------|
| Purpose | Read data | Create/Update/Delete data |
| HTTP Methods | Usually GET | POST, PUT, PATCH, DELETE |
| Auto-execution | Yes, on mount | No, manual trigger |
| Returns | Data + status | Trigger function + status |
| Caching | Cached by default | Not cached |
| Refetching | Automatic options | Manual via invalidation |

---

## Caching and Cache Invalidation

### How Caching Works

RTK Query automatically caches API responses. When you call `useGetPOsQuery()`:

1. **First call**: Makes network request, stores response in cache
2. **Subsequent calls**: Returns cached data instantly, no network request
3. **Different arguments**: Treated as different cache entries

```typescript
// These are cached separately (different cache keys)
useGetPOsQuery({ page: 1, limit: 10 });  // Cache key: "getPOs({"page":1,"limit":10})"
useGetPOsQuery({ page: 2, limit: 10 });  // Cache key: "getPOs({"page":2,"limit":10})"
useGetPOByIdQuery('123');                // Cache key: "getPOById("123")"
useGetPOByIdQuery('456');                // Cache key: "getPOById("456")"
```

### Cache Invalidation

When data is modified (created, updated, deleted), you need to "invalidate" the cache so that queries refetch fresh data. This is done using **Tags**.

```
[User Creates New PO] 
        ↓
[createPO mutation succeeds]
        ↓
[Cache tag 'PO' is invalidated]
        ↓
[All queries with tag 'PO' refetch automatically]
        ↓
[UI updates with new data]
```

---

## Tags System

Tags are labels that connect queries and mutations for cache invalidation.

### Defining Tags

```typescript
export const poApi = createApi({
  // ...
  tagTypes: ['PO', 'POItem', 'Dispatch'],  // Declare all tag types
  endpoints: (builder) => ({
    
    // Query: "This data is tagged as 'PO'"
    getPOs: builder.query({
      query: () => '/po',
      providesTags: ['PO'],  // This query provides 'PO' tagged data
    }),
    
    // Query with specific ID tags
    getPOById: builder.query({
      query: (id) => `/po/${id}`,
      providesTags: (result, error, id) => [
        { type: 'PO', id },  // Specific tag: 'PO' with id '123'
        'PO',                 // General tag: all 'PO' data
      ],
    }),
    
    // Mutation: "After this, invalidate 'PO' cache"
    createPO: builder.mutation({
      query: (newPO) => ({
        url: '/po',
        method: 'POST',
        body: newPO,
      }),
      invalidatesTags: ['PO'],  // Invalidate all 'PO' queries
    }),
    
    // Mutation with specific invalidation
    updatePO: builder.mutation({
      query: ({ id, ...data }) => ({
        url: `/po/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'PO', id },  // Invalidate specific PO
        'PO',                 // Also invalidate the list
      ],
    }),
  }),
});
```

### Tag Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        TAG SYSTEM                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  QUERIES provide tags:          MUTATIONS invalidate tags:   │
│  ┌─────────────────┐           ┌─────────────────┐          │
│  │ getPOs          │           │ createPO        │          │
│  │ providesTags:   │           │ invalidatesTags:│          │
│  │   ['PO']        │◄──────────│   ['PO']        │          │
│  └─────────────────┘           └─────────────────┘          │
│                                                              │
│  ┌─────────────────┐           ┌─────────────────┐          │
│  │ getPOById(123)  │           │ updatePO(123)   │          │
│  │ providesTags:   │           │ invalidatesTags:│          │
│  │   [{type:'PO',  │◄──────────│   [{type:'PO',  │          │
│  │     id: 123}]   │           │     id: 123}]   │          │
│  └─────────────────┘           └─────────────────┘          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## How RTK Query Fits with Redux

RTK Query integrates seamlessly with your existing Redux store.

### Store Structure

```typescript
// Your Redux store structure with RTK Query
{
  // Your existing slices
  auth: { currentUser: {...}, isAuthenticated: true, ... },
  po: { poList: [...], dispatchDetails: [...] },
  
  // RTK Query automatically adds its reducer here
  poApi: {
    queries: {
      'getPOs({"page":1})': { status: 'fulfilled', data: [...] },
      'getPOById("123")': { status: 'fulfilled', data: {...} },
    },
    mutations: {
      'createPO': { status: 'fulfilled', data: {...} },
    },
    // ... internal state
  },
}
```

### Coexistence with Slices

RTK Query can work alongside your existing slices:

```typescript
import { configureStore } from '@reduxjs/toolkit';
import { poApi } from './api/poApi';
import poReducer from './poSlice';       // Your existing slice
import authReducer from './authSlice';   // Your existing slice

export const store = configureStore({
  reducer: {
    // Your existing reducers
    po: poReducer,
    auth: authReducer,
    
    // RTK Query reducer (auto-generated)
    [poApi.reducerPath]: poApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(poApi.middleware),
});
```

### Hybrid Approach (Recommended)

Use RTK Query for API calls, keep slices for local-only state:

| Use RTK Query For | Use Slices For |
|-------------------|----------------|
| Fetching PO list from server | UI state (modals, tabs) |
| Creating/updating POs | Form state before submission |
| Server data caching | Authentication state |
| Loading/error states | Local filters/sorting |

---

## Authentication with JWT

Most APIs require authentication. Here's how to add JWT tokens to all requests:

### Setting Up Authenticated Requests

```typescript
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.REACT_APP_API_URL || 'http://localhost:3001/api',
    
    // This function runs before EVERY request
    prepareHeaders: (headers, { getState }) => {
      // Get the token from your auth state
      const state = getState() as RootState;
      const token = state.auth.currentUser?.token;
      
      // If we have a token, add it to the headers
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      // Always set content type for JSON
      headers.set('Content-Type', 'application/json');
      
      return headers;
    },
  }),
  tagTypes: [],
  endpoints: () => ({}),
});
```

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    Request Flow with JWT                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Component calls useGetPOsQuery()                         │
│           ↓                                                  │
│  2. RTK Query prepares the request                           │
│           ↓                                                  │
│  3. prepareHeaders() is called                               │
│           ↓                                                  │
│  4. Token is read from Redux state (auth.currentUser.token)  │
│           ↓                                                  │
│  5. 'Authorization: Bearer <token>' header is added          │
│           ↓                                                  │
│  6. Request is sent to server                                │
│           ↓                                                  │
│  7. Server validates token and returns data                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

RTK Query provides built-in error handling at multiple levels.

### Component-Level Error Handling

```typescript
const POList = () => {
  const { data, isLoading, isError, error } = useGetPOsQuery();
  
  if (isLoading) {
    return <Spin tip="Loading purchase orders..." />;
  }
  
  if (isError) {
    // Error object structure depends on your API
    const errorMessage = 'status' in error 
      ? `Error ${error.status}: ${JSON.stringify(error.data)}`
      : error.message;
      
    return <Alert type="error" message={errorMessage} />;
  }
  
  return <Table dataSource={data} />;
};
```

### Mutation Error Handling

```typescript
const CreatePOButton = () => {
  const [createPO, { isLoading, isError, error }] = useCreatePOMutation();
  
  const handleCreate = async () => {
    try {
      // .unwrap() extracts the payload or throws an error
      const result = await createPO(newPOData).unwrap();
      message.success('PO created successfully!');
    } catch (err) {
      // Handle error (err contains the error response)
      message.error(`Failed to create PO: ${err.data?.message || 'Unknown error'}`);
    }
  };
  
  return (
    <Button onClick={handleCreate} loading={isLoading}>
      Create PO
    </Button>
  );
};
```

### Error Types

```typescript
// RTK Query error can be one of these types:

// 1. FetchBaseQueryError - HTTP errors from the server
interface FetchBaseQueryError {
  status: number;           // HTTP status code (400, 404, 500, etc.)
  data: unknown;            // Response body from server
}

// 2. SerializedError - Client-side errors
interface SerializedError {
  name?: string;
  message?: string;
  stack?: string;
  code?: string;
}

// Type guard to check error type
function isFetchBaseQueryError(error: unknown): error is FetchBaseQueryError {
  return typeof error === 'object' && error != null && 'status' in error;
}
```

---

## Best Practices

### 1. Organize APIs by Feature

```
store/api/
├── baseApi.ts       # Shared base configuration
├── poApi.ts         # Purchase Order endpoints
├── userApi.ts       # User management endpoints
├── dispatchApi.ts   # Dispatch endpoints
└── index.ts         # Barrel export
```

### 2. Use Meaningful Tag Names

```typescript
// Good - descriptive and scoped
tagTypes: ['PO', 'POItem', 'Dispatch', 'User'],
providesTags: [{ type: 'PO', id: 'LIST' }],

// Bad - generic and confusing
tagTypes: ['Data', 'Item', 'Thing'],
```

### 3. Type Your Endpoints

```typescript
// Always provide request and response types
getPOById: builder.query<POResponse, string>({
  //                    ↑ Response    ↑ Request (id)
  query: (id) => `/po/${id}`,
}),

createPO: builder.mutation<POResponse, CreatePORequest>({
  //                      ↑ Response    ↑ Request body
  query: (newPO) => ({
    url: '/po',
    method: 'POST',
    body: newPO,
  }),
}),
```

### 4. Handle Loading States Gracefully

```typescript
// Show skeleton loaders instead of spinners
const POList = () => {
  const { data, isLoading } = useGetPOsQuery();
  
  if (isLoading) {
    return <Skeleton active paragraph={{ rows: 5 }} />;
  }
  
  return <Table dataSource={data} />;
};
```

### 5. Use `skip` to Conditionally Fetch

```typescript
const PODetails = ({ poId }) => {
  // Only fetch if we have a valid ID
  const { data } = useGetPOByIdQuery(poId, {
    skip: !poId,  // Skip the query if poId is falsy
  });
  
  return <Details data={data} />;
};
```

---

## Common Pitfalls

### 1. Forgetting to Add Middleware

```typescript
// ❌ WRONG - API won't work properly
export const store = configureStore({
  reducer: {
    [poApi.reducerPath]: poApi.reducer,
  },
});

// ✅ CORRECT - Always add the middleware
export const store = configureStore({
  reducer: {
    [poApi.reducerPath]: poApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(poApi.middleware),
});
```

### 2. Not Using `.unwrap()` for Error Handling

```typescript
// ❌ WRONG - Errors won't be caught
const handleCreate = async () => {
  const result = await createPO(data);
  // result is always successful here, errors are swallowed
};

// ✅ CORRECT - Use .unwrap() to get actual result or throw
const handleCreate = async () => {
  try {
    const result = await createPO(data).unwrap();
  } catch (err) {
    // Now errors are caught properly
  }
};
```

### 3. Mismatching Tags

```typescript
// ❌ WRONG - Tag mismatch, cache won't invalidate
getPOs: builder.query({
  providesTags: ['PurchaseOrders'],  // Using 'PurchaseOrders'
}),
createPO: builder.mutation({
  invalidatesTags: ['PO'],  // Invalidating 'PO' - doesn't match!
}),

// ✅ CORRECT - Tags match
getPOs: builder.query({
  providesTags: ['PO'],
}),
createPO: builder.mutation({
  invalidatesTags: ['PO'],
}),
```

### 4. Creating Multiple API Slices Incorrectly

```typescript
// ❌ WRONG - Don't create separate createApi for each feature
const poApi = createApi({ reducerPath: 'poApi', ... });
const userApi = createApi({ reducerPath: 'userApi', ... });

// ✅ CORRECT - Use one base API and inject endpoints
// baseApi.ts
export const baseApi = createApi({ reducerPath: 'api', ... });

// poApi.ts
export const poApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({ ... }),
});

// userApi.ts
export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({ ... }),
});
```

---

## Glossary

| Term | Definition |
|------|------------|
| **API Slice** | A collection of endpoints created with `createApi()` |
| **Endpoint** | A single API operation (query or mutation) |
| **Query** | An endpoint for fetching data (GET requests) |
| **Mutation** | An endpoint for modifying data (POST, PUT, DELETE) |
| **Base Query** | The function that handles HTTP requests |
| **Tag** | A label used for cache invalidation |
| **providesTags** | Declares what tags a query's data is associated with |
| **invalidatesTags** | Declares what tags should be invalidated after a mutation |
| **Cache Key** | Unique identifier for cached data (endpoint name + arguments) |
| **Reducer Path** | The key under which API state is stored in Redux |
| **Hook** | Auto-generated React function for using endpoints |
| **unwrap()** | Method to extract mutation result or throw error |

---

## Next Steps

Now that you understand the concepts, proceed to the **[RTK_QUERY_INTEGRATION.md](./RTK_QUERY_INTEGRATION.md)** for step-by-step implementation instructions.



