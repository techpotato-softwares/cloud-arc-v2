# RTK Query Integration - Step-by-Step Guide

This guide provides practical, copy-paste ready instructions for integrating RTK Query into the ArcForge CloudArc application.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Folder Structure](#folder-structure)
3. [Step 1: Create Base API Configuration](#step-1-create-base-api-configuration)
4. [Step 2: Create Feature-Specific API (PO Example)](#step-2-create-feature-specific-api-po-example)
5. [Step 3: Create Barrel Export](#step-3-create-barrel-export)
6. [Step 4: Integrate with Redux Store](#step-4-integrate-with-redux-store)
7. [Step 5: Use in Components](#step-5-use-in-components)
8. [Adding New APIs](#adding-new-apis)
9. [Quick Reference](#quick-reference)

---

## Prerequisites

RTK Query is already included with `@reduxjs/toolkit`. No additional installation needed.

Your `ui/package.json` should have:
```json
{
  "dependencies": {
    "@reduxjs/toolkit": "^2.11.0",
    "react-redux": "^9.2.0"
  }
}
```

---

## Folder Structure

Create the following folder structure inside `ui/src/store/`:

```
ui/src/store/
├── api/
│   ├── baseApi.ts      # Base API configuration with JWT auth
│   ├── poApi.ts        # Purchase Order API endpoints
│   ├── index.ts        # Barrel export for all APIs
│   │
│   │   # Future API files (add as needed):
│   ├── dispatchApi.ts  # Dispatch management endpoints
│   ├── userApi.ts      # User management endpoints
│   └── adminApi.ts     # Admin endpoints
│
├── authSlice.ts        # (existing) Keep for local auth state
├── poSlice.ts          # (existing) Keep for local PO state
├── hook.ts             # (existing) Typed hooks
└── index.ts            # Store configuration (will be updated)
```

---

## Step 1: Create Base API Configuration

Create `ui/src/store/api/baseApi.ts`:

```typescript
/**
 * Base API Configuration
 * 
 * This file sets up the foundation for all RTK Query APIs.
 * It handles:
 * - Base URL configuration
 * - JWT token injection for authenticated requests
 * - Common headers
 * 
 * All feature-specific APIs should use `baseApi.injectEndpoints()`
 * to add their endpoints.
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../index';

// API base URL - configure based on environment
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

/**
 * Base API slice with authentication
 * 
 * This creates a single API instance that all feature APIs will extend.
 * Using a single base API ensures:
 * - One middleware instance
 * - Shared caching
 * - Consistent authentication
 */
export const baseApi = createApi({
  // Unique key in Redux store - all API data stored under this path
  reducerPath: 'api',
  
  // Base query configuration
  baseQuery: fetchBaseQuery({
    baseUrl: API_BASE_URL,
    
    // Prepare headers for every request
    prepareHeaders: (headers, { getState }) => {
      // Get current auth state
      const state = getState() as RootState;
      
      // If user is authenticated, add JWT token
      // Adjust the path based on where you store the token
      const token = state.auth.currentUser?.token;
      
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      
      // Set content type for JSON requests
      headers.set('Content-Type', 'application/json');
      
      return headers;
    },
  }),
  
  // Define all tag types used across APIs for cache invalidation
  // Add new tags here as you create new APIs
  tagTypes: [
    'PO',           // Purchase Orders
    'POItem',       // PO Line Items
    'Dispatch',     // Dispatch Details
    'User',         // Users
    'Role',         // Roles
    'Permission',   // Permissions
  ],
  
  // Base endpoints - empty, will be extended by feature APIs
  endpoints: () => ({}),
});
```

---

## Step 2: Create Feature-Specific API (PO Example)

Create `ui/src/store/api/poApi.ts`:

```typescript
/**
 * Purchase Order API
 * 
 * This file contains all API endpoints related to Purchase Orders.
 * It extends the baseApi using `injectEndpoints`.
 * 
 * Endpoints:
 * - getPOs: Fetch list of POs with pagination and filters
 * - getPOById: Fetch a single PO by ID
 * - createPO: Create a new PO
 * - updatePO: Update an existing PO
 * - deletePO: Delete a PO
 */

import { baseApi } from './baseApi';

// ============================================
// Type Definitions
// ============================================

/**
 * PO Item in a Purchase Order
 */
export interface POItem {
  id?: string;
  category: string;
  oemName: string;
  product: string;
  quantity: number;
  spareQuantity: number;
  totalQuantity: number;
  pricePerUnit: number;
  totalPrice: number;
  warranty: string;
}

/**
 * Purchase Order Response from API
 */
export interface POResponse {
  id: string;
  date: string;
  clientName: string;
  osgPiNo: number;
  osgPiDate: string;
  clientPoNo: number;
  clientPoDate: string;
  poStatus: string;
  noOfDispatch: string;
  clientAddress: string;
  clientContact: string;
  poItems: POItem[];
  dispatchPlanDate: string;
  siteLocation: string;
  oscSupport: string;
  confirmDateOfDispatch: string;
  paymentStatus: string;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request params for listing POs
 */
export interface ListPOParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  clientName?: string;
  poStatus?: string;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Request body for creating a PO
 */
export interface CreatePORequest {
  date: string;
  clientName: string;
  osgPiNo: number;
  osgPiDate: string;
  clientPoNo: number;
  clientPoDate: string;
  poStatus: string;
  noOfDispatch: string;
  clientAddress: string;
  clientContact: string;
  poItems: POItem[];
  dispatchPlanDate: string;
  siteLocation: string;
  oscSupport: string;
  confirmDateOfDispatch: string;
  paymentStatus: string;
  remarks?: string;
}

/**
 * Request body for updating a PO
 */
export interface UpdatePORequest extends Partial<CreatePORequest> {
  id: string;
}

// ============================================
// API Response Wrapper (matches backend format)
// ============================================

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================
// PO API Endpoints
// ============================================

export const poApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /po
     * Fetch paginated list of Purchase Orders
     * 
     * @param params - Pagination and filter parameters
     * @returns Paginated list of POs
     * 
     * Usage:
     * const { data, isLoading } = useGetPOsQuery({ page: 1, limit: 10 });
     */
    getPOs: builder.query<PaginatedResponse<POResponse>, ListPOParams | void>({
      query: (params) => ({
        url: '/po',
        params: params || {},
      }),
      // Transform the API response to extract data
      transformResponse: (response: ApiResponse<POResponse[]>) => ({
        items: response.data,
        pagination: response.pagination || {
          page: 1,
          limit: 10,
          total: response.data.length,
          totalPages: 1,
        },
      }),
      // Tag this data for cache invalidation
      providesTags: (result) =>
        result
          ? [
              // Tag each individual PO
              ...result.items.map(({ id }) => ({ type: 'PO' as const, id })),
              // Tag for the entire list
              { type: 'PO', id: 'LIST' },
            ]
          : [{ type: 'PO', id: 'LIST' }],
    }),

    /**
     * GET /po/:id
     * Fetch a single Purchase Order by ID
     * 
     * @param id - PO ID
     * @returns Single PO object
     * 
     * Usage:
     * const { data, isLoading } = useGetPOByIdQuery('po-123');
     */
    getPOById: builder.query<POResponse, string>({
      query: (id) => `/po/${id}`,
      // Transform the API response to extract data
      transformResponse: (response: ApiResponse<POResponse>) => response.data,
      // Tag this specific PO
      providesTags: (result, error, id) => [{ type: 'PO', id }],
    }),

    /**
     * POST /po
     * Create a new Purchase Order
     * 
     * @param newPO - PO data to create
     * @returns Created PO object
     * 
     * Usage:
     * const [createPO, { isLoading }] = useCreatePOMutation();
     * await createPO(poData).unwrap();
     */
    createPO: builder.mutation<POResponse, CreatePORequest>({
      query: (newPO) => ({
        url: '/po',
        method: 'POST',
        body: newPO,
      }),
      // Transform the API response to extract data
      transformResponse: (response: ApiResponse<POResponse>) => response.data,
      // Invalidate the list cache so it refetches
      invalidatesTags: [{ type: 'PO', id: 'LIST' }],
    }),

    /**
     * PUT /po/:id
     * Update an existing Purchase Order
     * 
     * @param updateData - PO data including ID
     * @returns Updated PO object
     * 
     * Usage:
     * const [updatePO, { isLoading }] = useUpdatePOMutation();
     * await updatePO({ id: 'po-123', clientName: 'New Name' }).unwrap();
     */
    updatePO: builder.mutation<POResponse, UpdatePORequest>({
      query: ({ id, ...body }) => ({
        url: `/po/${id}`,
        method: 'PUT',
        body,
      }),
      // Transform the API response to extract data
      transformResponse: (response: ApiResponse<POResponse>) => response.data,
      // Invalidate both the specific PO and the list
      invalidatesTags: (result, error, { id }) => [
        { type: 'PO', id },
        { type: 'PO', id: 'LIST' },
      ],
    }),

    /**
     * DELETE /po/:id
     * Delete a Purchase Order
     * 
     * @param id - PO ID to delete
     * @returns Deletion confirmation
     * 
     * Usage:
     * const [deletePO, { isLoading }] = useDeletePOMutation();
     * await deletePO('po-123').unwrap();
     */
    deletePO: builder.mutation<{ id: string; deleted: boolean }, string>({
      query: (id) => ({
        url: `/po/${id}`,
        method: 'DELETE',
      }),
      // Transform the API response to extract data
      transformResponse: (response: ApiResponse<{ id: string; deleted: boolean }>) => response.data,
      // Invalidate the list cache
      invalidatesTags: (result, error, id) => [
        { type: 'PO', id },
        { type: 'PO', id: 'LIST' },
      ],
    }),
  }),
  
  // Don't override existing endpoints if they exist
  overrideExisting: false,
});

// ============================================
// Export Auto-Generated Hooks
// ============================================

export const {
  // Query hooks
  useGetPOsQuery,
  useGetPOByIdQuery,
  useLazyGetPOsQuery,        // Lazy version - trigger manually
  useLazyGetPOByIdQuery,     // Lazy version - trigger manually
  
  // Mutation hooks
  useCreatePOMutation,
  useUpdatePOMutation,
  useDeletePOMutation,
} = poApi;
```

---

## Step 3: Create Barrel Export

Create `ui/src/store/api/index.ts`:

```typescript
/**
 * API Barrel Export
 * 
 * This file exports all API-related items from a single location.
 * Import from here instead of individual files for cleaner imports.
 * 
 * Usage in components:
 * import { useGetPOsQuery, useCreatePOMutation } from '../store/api';
 */

// Base API (needed for store configuration)
export { baseApi } from './baseApi';

// PO API hooks and types
export {
  poApi,
  useGetPOsQuery,
  useGetPOByIdQuery,
  useLazyGetPOsQuery,
  useLazyGetPOByIdQuery,
  useCreatePOMutation,
  useUpdatePOMutation,
  useDeletePOMutation,
} from './poApi';

// Export types for use in components
export type {
  POItem,
  POResponse,
  ListPOParams,
  PaginatedResponse,
  CreatePORequest,
  UpdatePORequest,
} from './poApi';

// ============================================
// Add exports for new APIs below:
// ============================================

// Example: Dispatch API (when created)
// export {
//   useGetDispatchesQuery,
//   useCreateDispatchMutation,
// } from './dispatchApi';

// Example: User API (when created)
// export {
//   useGetUsersQuery,
//   useCreateUserMutation,
// } from './userApi';
```

---

## Step 4: Integrate with Redux Store

Update `ui/src/store/index.ts`:

```typescript
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import storage from "redux-persist/lib/storage";
import poReducer from "./poSlice";
import authReducer from "./authSlice";

// Import the base API
import { baseApi } from "./api";

// Persist configuration
const persistConfig = {
  key: "root",
  version: 1,
  storage,
  whitelist: ["po", "auth"], // Persist both 'po' and 'auth' reducers
  // Note: Don't persist the API cache - it should be fetched fresh
  blacklist: [baseApi.reducerPath],
};

// Combine reducers
const rootReducer = combineReducers({
  po: poReducer,
  auth: authReducer,
  // Add the RTK Query API reducer
  [baseApi.reducerPath]: baseApi.reducer,
});

// Create persisted reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// Configure store with persisted reducer
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }).concat(baseApi.middleware), // Add API middleware
});

// Create persistor
export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

---

## Step 5: Use in Components

### Example 1: Displaying a List with Query

```typescript
// ui/src/Components/PurchaseOrderDetails/PurchaseOrderList.tsx

import React from 'react';
import { Table, Spin, Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useGetPOsQuery } from '../../store/api';

const PurchaseOrderList: React.FC = () => {
  // Fetch POs with default pagination
  const { 
    data,           // Response data (PaginatedResponse<POResponse>)
    isLoading,      // First load
    isFetching,     // Any fetch (including refetch)
    isError,        // Request failed
    error,          // Error details
    refetch,        // Manual refetch function
  } = useGetPOsQuery({ page: 1, limit: 10 });

  // Loading state
  if (isLoading) {
    return <Spin tip="Loading purchase orders..." />;
  }

  // Error state
  if (isError) {
    return (
      <Alert
        type="error"
        message="Failed to load purchase orders"
        description={JSON.stringify(error)}
        action={
          <Button onClick={refetch} icon={<ReloadOutlined />}>
            Retry
          </Button>
        }
      />
    );
  }

  // Success state
  return (
    <div>
      <Button 
        onClick={refetch} 
        loading={isFetching}
        icon={<ReloadOutlined />}
        style={{ marginBottom: 16 }}
      >
        Refresh
      </Button>
      
      <Table
        dataSource={data?.items}
        rowKey="id"
        loading={isFetching}
        pagination={{
          current: data?.pagination.page,
          pageSize: data?.pagination.limit,
          total: data?.pagination.total,
        }}
        columns={[
          { title: 'PO ID', dataIndex: 'id', key: 'id' },
          { title: 'Client', dataIndex: 'clientName', key: 'clientName' },
          { title: 'Status', dataIndex: 'poStatus', key: 'poStatus' },
          { title: 'Date', dataIndex: 'date', key: 'date' },
        ]}
      />
    </div>
  );
};

export default PurchaseOrderList;
```

### Example 2: Creating Data with Mutation

```typescript
// ui/src/Components/PurchaseOrderDetails/CreatePurchaseOrderForm.tsx

import React from 'react';
import { Form, Input, Button, message } from 'antd';
import { useCreatePOMutation, CreatePORequest } from '../../store/api';

const CreatePurchaseOrderForm: React.FC = () => {
  const [form] = Form.useForm();
  
  // Get the mutation hook
  const [createPO, { 
    isLoading,    // Mutation in progress
    isSuccess,    // Mutation succeeded
    isError,      // Mutation failed
    error,        // Error details
    reset,        // Reset mutation state
  }] = useCreatePOMutation();

  const handleSubmit = async (values: CreatePORequest) => {
    try {
      // Call the mutation and unwrap to handle errors
      const result = await createPO(values).unwrap();
      
      message.success(`PO created successfully! ID: ${result.id}`);
      form.resetFields();
      reset(); // Reset mutation state
      
    } catch (err: any) {
      // Error is caught here due to .unwrap()
      message.error(`Failed to create PO: ${err.data?.message || 'Unknown error'}`);
    }
  };

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      <Form.Item
        name="clientName"
        label="Client Name"
        rules={[{ required: true, message: 'Please enter client name' }]}
      >
        <Input placeholder="Enter client name" />
      </Form.Item>

      <Form.Item
        name="date"
        label="Date"
        rules={[{ required: true, message: 'Please select date' }]}
      >
        <Input type="date" />
      </Form.Item>

      {/* Add more form fields as needed */}

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={isLoading}>
          Create Purchase Order
        </Button>
      </Form.Item>
    </Form>
  );
};

export default CreatePurchaseOrderForm;
```

### Example 3: Updating Data with Mutation

```typescript
// ui/src/Components/PurchaseOrderDetails/EditPurchaseOrder.tsx

import React from 'react';
import { Form, Input, Button, Spin, message } from 'antd';
import { 
  useGetPOByIdQuery, 
  useUpdatePOMutation,
  UpdatePORequest 
} from '../../store/api';

interface Props {
  poId: string;
  onSuccess?: () => void;
}

const EditPurchaseOrder: React.FC<Props> = ({ poId, onSuccess }) => {
  const [form] = Form.useForm();
  
  // Fetch existing PO data
  const { data: po, isLoading: isLoadingPO } = useGetPOByIdQuery(poId);
  
  // Update mutation
  const [updatePO, { isLoading: isUpdating }] = useUpdatePOMutation();

  // Set form values when data loads
  React.useEffect(() => {
    if (po) {
      form.setFieldsValue(po);
    }
  }, [po, form]);

  const handleSubmit = async (values: Partial<UpdatePORequest>) => {
    try {
      await updatePO({ id: poId, ...values }).unwrap();
      message.success('PO updated successfully!');
      onSuccess?.();
    } catch (err: any) {
      message.error(`Failed to update PO: ${err.data?.message || 'Unknown error'}`);
    }
  };

  if (isLoadingPO) {
    return <Spin tip="Loading PO details..." />;
  }

  return (
    <Form form={form} onFinish={handleSubmit} layout="vertical">
      <Form.Item name="clientName" label="Client Name">
        <Input />
      </Form.Item>

      <Form.Item name="poStatus" label="Status">
        <Input />
      </Form.Item>

      <Button type="primary" htmlType="submit" loading={isUpdating}>
        Update Purchase Order
      </Button>
    </Form>
  );
};

export default EditPurchaseOrder;
```

### Example 4: Deleting Data with Confirmation

```typescript
// ui/src/Components/PurchaseOrderDetails/DeletePOButton.tsx

import React from 'react';
import { Button, Popconfirm, message } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { useDeletePOMutation } from '../../store/api';

interface Props {
  poId: string;
  onSuccess?: () => void;
}

const DeletePOButton: React.FC<Props> = ({ poId, onSuccess }) => {
  const [deletePO, { isLoading }] = useDeletePOMutation();

  const handleDelete = async () => {
    try {
      await deletePO(poId).unwrap();
      message.success('PO deleted successfully!');
      onSuccess?.();
    } catch (err: any) {
      message.error(`Failed to delete PO: ${err.data?.message || 'Unknown error'}`);
    }
  };

  return (
    <Popconfirm
      title="Delete Purchase Order"
      description="Are you sure you want to delete this PO?"
      onConfirm={handleDelete}
      okText="Yes, Delete"
      cancelText="Cancel"
      okButtonProps={{ danger: true }}
    >
      <Button 
        danger 
        icon={<DeleteOutlined />} 
        loading={isLoading}
      >
        Delete
      </Button>
    </Popconfirm>
  );
};

export default DeletePOButton;
```

### Example 5: Conditional Fetching with Skip

```typescript
// Fetch only when ID is available

import { useGetPOByIdQuery } from '../../store/api';

const PODetails: React.FC<{ poId?: string }> = ({ poId }) => {
  const { data, isLoading } = useGetPOByIdQuery(poId!, {
    // Skip the query if poId is undefined or empty
    skip: !poId,
  });

  if (!poId) {
    return <div>Select a PO to view details</div>;
  }

  if (isLoading) {
    return <Spin />;
  }

  return <div>{data?.clientName}</div>;
};
```

### Example 6: Polling (Auto-Refresh)

```typescript
// Auto-refresh data every 30 seconds

import { useGetPOsQuery } from '../../store/api';

const LivePOList: React.FC = () => {
  const { data, isFetching } = useGetPOsQuery(undefined, {
    // Refetch every 30 seconds
    pollingInterval: 30000,
    
    // Don't poll when window is not focused
    skipPollingIfUnfocused: true,
  });

  return (
    <div>
      {isFetching && <span>Updating...</span>}
      {/* Render list */}
    </div>
  );
};
```

---

## Adding New APIs

To add a new API (e.g., Dispatch API), follow these steps:

### Step 1: Create the API file

Create `ui/src/store/api/dispatchApi.ts`:

```typescript
import { baseApi } from './baseApi';

// Define types
export interface DispatchResponse {
  id: string;
  poId: string;
  product: string;
  // ... other fields
}

export interface CreateDispatchRequest {
  poId: string;
  product: string;
  // ... other fields
}

// Inject endpoints into base API
export const dispatchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDispatches: builder.query<DispatchResponse[], string>({
      query: (poId) => `/dispatch?poId=${poId}`,
      providesTags: ['Dispatch'],
    }),
    
    createDispatch: builder.mutation<DispatchResponse, CreateDispatchRequest>({
      query: (data) => ({
        url: '/dispatch',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Dispatch'],
    }),
  }),
});

export const {
  useGetDispatchesQuery,
  useCreateDispatchMutation,
} = dispatchApi;
```

### Step 2: Export from index

Update `ui/src/store/api/index.ts`:

```typescript
// ... existing exports

// Dispatch API
export {
  useGetDispatchesQuery,
  useCreateDispatchMutation,
} from './dispatchApi';

export type {
  DispatchResponse,
  CreateDispatchRequest,
} from './dispatchApi';
```

### Step 3: Add tags to baseApi (if new)

If you need new tag types, add them in `baseApi.ts`:

```typescript
tagTypes: [
  'PO',
  'Dispatch',  // Add new tag
  // ...
],
```

---

## Quick Reference

### Query Hook Return Values

```typescript
const {
  data,              // Response data (undefined until loaded)
  currentData,       // Current data (doesn't change during refetch)
  isLoading,         // true on first load (no cached data)
  isFetching,        // true during any fetch
  isSuccess,         // Query succeeded
  isError,           // Query failed
  error,             // Error object
  isUninitialized,   // Query hasn't started
  refetch,           // Manual refetch function
} = useGetPOsQuery();
```

### Mutation Hook Return Values

```typescript
const [
  triggerFn,         // Function to call the mutation
  {
    data,            // Response data
    isLoading,       // Mutation in progress
    isSuccess,       // Mutation succeeded
    isError,         // Mutation failed
    error,           // Error object
    reset,           // Reset mutation state
  }
] = useCreatePOMutation();

// Call mutation
const result = await triggerFn(requestBody).unwrap();
```

### Common Query Options

```typescript
useGetPOsQuery(args, {
  skip: boolean,                  // Skip the query
  pollingInterval: number,        // Auto-refetch interval (ms)
  refetchOnMountOrArgChange: boolean | number,
  refetchOnFocus: boolean,        // Refetch when window regains focus
  refetchOnReconnect: boolean,    // Refetch when network reconnects
});
```

### Import Pattern

```typescript
// Always import from the barrel export
import { 
  useGetPOsQuery, 
  useCreatePOMutation,
  POResponse,
  CreatePORequest,
} from '../store/api';
```

---

## Related Documentation

- [RTK_QUERY_GUIDE.md](./RTK_QUERY_GUIDE.md) - Comprehensive concepts guide
- [Redux Toolkit Query Docs](https://redux-toolkit.js.org/rtk-query/overview)

