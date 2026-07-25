# Dispatch API - Implementation Review & Frontend Integration Plan

## Executive Summary

This document provides:

1. **Review** of the backend implementation plan
2. **Improvements** needed for the implementation
3. **Frontend integration strategy** (migrating from Redux slice to RTK Query APIs)
4. **Step-by-step migration plan**

---

## 1. Backend Implementation Review

### ✅ Strengths of Current Plan

1. **Well-structured database schema** - Proper normalization with dispatch and dispatched_items tables
2. **Clear separation of concerns** - Three distinct API sections (details, documents, delivery)
3. **Follows project patterns** - Controller-Service-Repository pattern, Inversify DI
4. **Comprehensive API endpoints** - All necessary CRUD operations

### ⚠️ Areas for Improvement

#### 1.1 API Response Format Inconsistency

**Issue**: The document mentions standardized responses, but the `getPOById` endpoint in `poApi.ts` doesn't use `transformResponse`, suggesting the backend might return data directly.

**Recommendation**: Clarify in the implementation document that:

- All endpoints MUST return `{ success: boolean, data: T, pagination?: {...} }`
- Use `transformResponse` in RTK Query to extract `data` field
- List endpoints should wrap data in `{ data: T[], pagination: {...} }`

#### 1.2 Missing PreCommissioning Relation

**Issue**: The Dispatch model has `preCommissionings` relation, but PreCommissioning model structure is not defined in the document.

**Recommendation**: Verify PreCommissioning model exists and has proper `dispatchId` foreign key. This is fine if it exists, but should be noted.

#### 1.3 Error Handling Standardization

**Issue**: Error responses should be standardized.

**Recommendation**: Add error response format:

```json
{
  "statusCode": 400,
  "body": {
    "success": false,
    "error": {
      "message": "Error message",
      "code": "ERROR_CODE",
      "details": {}
    }
  }
}
```

#### 1.4 ID Type Consistency

**Issue**: Document says "All IDs should be numbers", but `poId` is a string (OSG-00000001 format). Dispatch IDs are numbers, which is correct.

**Recommendation**: ✅ This is fine - dispatch IDs are numbers, PO IDs remain strings. Just ensure consistency in API responses.

---

## 2. Frontend Integration Strategy

### Current State Analysis

**Current Implementation:**

- Dispatch data is stored in **Redux slice** (`poSlice.ts`)
- Uses local state management (not API calls)
- Data persists in Redux store (not from backend)
- Forms update Redux store directly

**Target State:**

- Migrate to **RTK Query** APIs (`dispatchApi.ts`)
- All data fetched from backend
- Real-time synchronization
- Proper caching and invalidation

### Migration Strategy: Hybrid Approach

Instead of a big-bang migration, use a **hybrid approach**:

1. **Phase 1**: Create RTK Query APIs alongside existing Redux slice
2. **Phase 2**: Update components to use APIs for READ operations
3. **Phase 3**: Update forms to use APIs for CREATE/UPDATE operations
4. **Phase 4**: Remove Redux slice once fully migrated

---

## 3. Type Sharing Strategy

### Option A: Shared Types Package (Recommended)

Create a shared types package that both frontend and backend can use:

**Structure:**

```
shared-types/
├── package.json
├── src/
│   ├── dispatch.ts
│   ├── po.ts
│   └── index.ts
└── tsconfig.json
```

**Benefits:**

- Single source of truth
- Type safety across frontend/backend
- Automatic synchronization

**Implementation:**

1. Create `shared-types` package
2. Backend imports from `shared-types`
3. Frontend imports from `shared-types` via `@OrianaTypes` alias
4. Export types in `package.json` exports field

### Option B: Type Generation (Alternative)

Generate TypeScript types from backend schemas:

**Tools:**

- `json-schema-to-typescript`
- `openapi-typescript`
- Manual type exports from backend

**Current Approach:**

- Frontend defines types in `@OrianaTypes` (check if this exists)
- Backend defines types in `schemas/`
- Manual synchronization required

**Recommendation**: Start with Option B (current approach), plan for Option A later.

---

## 4. Frontend API Implementation Plan

### Step 1: Create Dispatch API File

Create `ui/src/store/api/dispatchApi.ts`:

```typescript
/**
 * Dispatch API
 *
 * This file contains all API endpoints related to Dispatch.
 * Migrating from Redux slice to RTK Query APIs.
 */

import { baseApi } from './baseApi';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
  DispatchResponse,
  DispatchListResponse,
} from '@OrianaTypes'; // Or from shared types

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

export const dispatchApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * GET /dispatch
     * Fetch paginated list of dispatches
     */
    getDispatches: builder.query<DispatchListResponse, ListDispatchRequest | void>({
      query: (params) => ({
        url: '/dispatch',
        params: params || {},
      }),
      transformResponse: (response: ApiResponse<DispatchResponse[]>) => ({
        data: response.data,
        pagination: response.pagination || {
          page: 1,
          limit: 20,
          total: response.data.length,
          totalPages: 1,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ dispatchId }) => ({
                type: 'Dispatch' as const,
                id: dispatchId,
              })),
              { type: 'Dispatch', id: 'LIST' },
            ]
          : [{ type: 'Dispatch', id: 'LIST' }],
    }),

    /**
     * GET /dispatch/po/:poId
     * Fetch all dispatches for a specific PO
     */
    getDispatchesByPoId: builder.query<DispatchResponse[], string>({
      query: (poId) => `/dispatch/po/${poId}`,
      transformResponse: (response: ApiResponse<DispatchResponse[]>) => response.data,
      providesTags: (result, error, poId) =>
        result
          ? [
              ...result.map(({ dispatchId }) => ({
                type: 'Dispatch' as const,
                id: dispatchId,
              })),
              { type: 'Dispatch', id: `PO-${poId}` },
            ]
          : [{ type: 'Dispatch', id: `PO-${poId}` }],
    }),

    /**
     * GET /dispatch/:id
     * Fetch a single dispatch by ID
     */
    getDispatchById: builder.query<DispatchResponse, number>({
      query: (id) => `/dispatch/${id}`,
      transformResponse: (response: ApiResponse<DispatchResponse>) => response.data,
      providesTags: (result, error, id) => [{ type: 'Dispatch', id }],
    }),

    /**
     * POST /dispatch
     * Create a new dispatch
     */
    createDispatch: builder.mutation<DispatchResponse, CreateDispatchRequest>({
      query: (newDispatch) => ({
        url: '/dispatch',
        method: 'POST',
        body: newDispatch,
      }),
      transformResponse: (response: ApiResponse<DispatchResponse>) => response.data,
      invalidatesTags: (result, error, { poId }) => [
        { type: 'Dispatch', id: 'LIST' },
        { type: 'Dispatch', id: `PO-${poId}` },
        { type: 'PO', id: poId }, // Invalidate PO cache to refresh dispatch count
      ],
    }),

    /**
     * PUT /dispatch/:id
     * Update dispatch details (Section 1)
     */
    updateDispatchDetails: builder.mutation<
      DispatchResponse,
      { id: number; data: UpdateDispatchDetailsRequest }
    >({
      query: ({ id, data }) => ({
        url: `/dispatch/${id}`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<DispatchResponse>) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
        result ? { type: 'Dispatch', id: `PO-${result.poId}` } : [],
      ],
    }),

    /**
     * PUT /dispatch/:id/documents
     * Update dispatch documents (Section 2)
     */
    updateDispatchDocuments: builder.mutation<
      DispatchResponse,
      { id: number; data: UpdateDispatchDocumentsRequest }
    >({
      query: ({ id, data }) => ({
        url: `/dispatch/${id}/documents`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<DispatchResponse>) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
        result ? { type: 'Dispatch', id: `PO-${result.poId}` } : [],
      ],
    }),

    /**
     * PUT /dispatch/:id/delivery
     * Update delivery confirmation (Section 3)
     */
    updateDeliveryConfirmation: builder.mutation<
      DispatchResponse,
      { id: number; data: UpdateDeliveryConfirmationRequest }
    >({
      query: ({ id, data }) => ({
        url: `/dispatch/${id}/delivery`,
        method: 'PUT',
        body: data,
      }),
      transformResponse: (response: ApiResponse<DispatchResponse>) => response.data,
      invalidatesTags: (result, error, { id }) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
        result ? { type: 'Dispatch', id: `PO-${result.poId}` } : [],
      ],
    }),

    /**
     * DELETE /dispatch/:id
     * Delete a dispatch
     */
    deleteDispatch: builder.mutation<{ dispatchId: number; deleted: boolean }, number>({
      query: (id) => ({
        url: `/dispatch/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (response: ApiResponse<{ dispatchId: number; deleted: boolean }>) =>
        response.data,
      invalidatesTags: (result, error, id) => [
        { type: 'Dispatch', id },
        { type: 'Dispatch', id: 'LIST' },
      ],
    }),
  }),

  overrideExisting: false,
});

// Export hooks
export const {
  useGetDispatchesQuery,
  useGetDispatchesByPoIdQuery,
  useGetDispatchByIdQuery,
  useLazyGetDispatchesQuery,
  useLazyGetDispatchesByPoIdQuery,
  useLazyGetDispatchByIdQuery,
  useCreateDispatchMutation,
  useUpdateDispatchDetailsMutation,
  useUpdateDispatchDocumentsMutation,
  useUpdateDeliveryConfirmationMutation,
  useDeleteDispatchMutation,
} = dispatchApi;
```

### Step 2: Update Base API Tags

Update `ui/src/store/api/baseApi.ts` to include Dispatch tag (already present):

```typescript
tagTypes: [
  "PO",
  "Dispatch", // ✅ Already present
  // ... other tags
],
```

### Step 3: Component Migration Strategy

#### Phase 1: Read Operations (Non-breaking)

**File**: `ui/src/pages/PODetails.tsx`

**Current:**

```typescript
const dispatchDetails = useAppSelector(selectDispatchDetails);
```

**New:**

```typescript
const {
  data: dispatchDetails = [],
  isLoading,
  isError,
} = useGetDispatchesByPoIdQuery(poId || '', {
  skip: !poId,
});
```

**Benefits:**

- Data fetched from backend
- Automatic caching
- Real-time updates
- No breaking changes (can keep Redux slice for now)

#### Phase 2: Write Operations (Breaking)

**File**: `ui/src/Components/POManagement/DispatchFormModal.tsx`

**Current:**

```typescript
dispatch(addDispatchDetail(dispatchData));
```

**New:**

```typescript
const [createDispatch, { isLoading: isCreating }] = useCreateDispatchMutation();

const handleSubmit = async () => {
  try {
    const values = await form.validateFields();
    await createDispatch({
      poId: selectedPO.id,
      ...values,
    }).unwrap();
    message.success('Dispatch created successfully');
    onClose();
  } catch (error) {
    message.error('Failed to create dispatch');
  }
};
```

**Similar updates needed for:**

- `DispatchDocumentFormModal.tsx` → `useUpdateDispatchDocumentsMutation`
- `DeliveryConfirmationFormModal.tsx` → `useUpdateDeliveryConfirmationMutation`

---

## 5. Type Definitions

### Create Type File: `ui/src/types/dispatch.ts`

```typescript
/**
 * Dispatch Types
 *
 * These types should match the backend schemas.
 * Consider moving to shared types package in future.
 */

export interface DispatchedItemRequest {
  productId: number;
  quantity: number;
  serialNumbers?: string;
}

export interface DispatchedItemResponse {
  id: number;
  productId: number;
  productName?: string;
  quantity: number;
  serialNumbers?: string;
}

export interface CreateDispatchRequest {
  poId: string;
  dispatchedItems: DispatchedItemRequest[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string;
  deliveryContact: string;
  remarks?: string;
}

export interface UpdateDispatchDetailsRequest {
  dispatchedItems?: DispatchedItemRequest[];
  projectName?: string;
  projectLocation?: string;
  deliveryLocation?: string;
  deliveryAddress?: string;
  googleMapLink?: string;
  confirmDispatchDate?: string;
  deliveryContact?: string;
  remarks?: string;
}

export interface UpdateDispatchDocumentsRequest {
  noDuesClearance?: string;
  docOsgPiNo?: string;
  docOsgPiDate?: string;
  taxInvoiceNumber?: string;
  invoiceDate?: string;
  ewayBill?: string;
  deliveryChallan?: string;
  dispatchDate?: string;
  packagingList?: string;
  dispatchFromLocation?: string;
  dispatchStatus?: string;
  dispatchLrNo?: string;
  dispatchRemarks?: string;
}

export interface UpdateDeliveryConfirmationRequest {
  dateOfDelivery?: string;
  deliveryStatus?: string;
  proofOfDelivery?: string;
}

export interface DispatchResponse {
  dispatchId: number;
  poId: string;
  dispatchedItems: DispatchedItemResponse[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string;
  deliveryContact: string;
  remarks?: string;
  noDuesClearance?: string;
  docOsgPiNo?: string;
  docOsgPiDate?: string;
  taxInvoiceNumber?: string;
  invoiceDate?: string;
  ewayBill?: string;
  deliveryChallan?: string;
  dispatchDate?: string;
  packagingList?: string;
  dispatchFromLocation?: string;
  dispatchStatus?: string;
  dispatchLrNo?: string;
  dispatchRemarks?: string;
  documentUpdatedAt?: string;
  dateOfDelivery?: string;
  deliveryStatus?: string;
  proofOfDelivery?: string;
  deliveryUpdatedAt?: string;
  createdById?: number;
  createdBy?: string;
  updatedById?: number;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DispatchListResponse {
  data: DispatchResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ListDispatchRequest {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  poId?: string;
  dispatchStatus?: string;
  deliveryStatus?: string;
}
```

---

## 6. Migration Checklist

### Backend Implementation

- [ ] Step 1: Update Prisma schema and run migrations
- [ ] Step 2: Create constants file
- [ ] Step 3: Create request/response schemas
- [ ] Step 4: Implement repository
- [ ] Step 5: Implement service
- [ ] Step 6: Implement controller
- [ ] Step 7: Create lambda configuration
- [ ] Step 8: Test all endpoints
- [ ] Step 9: Document API endpoints (OpenAPI/Swagger)

### Frontend Integration

- [ ] Step 1: Create type definitions (`ui/src/types/dispatch.ts`)
- [ ] Step 2: Create dispatch API file (`ui/src/store/api/dispatchApi.ts`)
- [ ] Step 3: Update PODetails page to use `useGetDispatchesByPoIdQuery`
- [ ] Step 4: Update DispatchFormModal to use `useCreateDispatchMutation`
- [ ] Step 5: Update DispatchDocumentFormModal to use `useUpdateDispatchDocumentsMutation`
- [ ] Step 6: Update DeliveryConfirmationFormModal to use `useUpdateDeliveryConfirmationMutation`
- [ ] Step 7: Update delete handlers to use `useDeleteDispatchMutation`
- [ ] Step 8: Remove Redux slice dispatch actions (keep types if needed)
- [ ] Step 9: Test all functionality
- [ ] Step 10: Remove unused Redux slice code

---

## 7. Testing Strategy

### Backend Testing

1. **Unit Tests**: Service and Repository layers
2. **Integration Tests**: API endpoints
3. **Manual Testing**: Postman/API Gateway console

### Frontend Testing

1. **Component Tests**: Form submissions, data display
2. **Integration Tests**: API calls, cache invalidation
3. **E2E Tests**: Full user flows (create dispatch → update documents → delivery confirmation)

---

## 8. Rollback Plan

If issues arise during migration:

1. **Keep Redux slice active** (hybrid mode)
2. **Feature flag** to switch between API and Redux slice
3. **Gradual rollout** - migrate one component at a time
4. **Monitor errors** - track API failures vs Redux failures

---

## 9. Performance Considerations

### Caching Strategy

- RTK Query automatically caches responses
- Cache invalidation on mutations
- Stale-while-revalidate pattern

### Optimization Tips

1. **Pagination**: Use for large dispatch lists
2. **Selective fetching**: Only fetch needed fields
3. **Lazy queries**: Use `useLazyQuery` for on-demand fetching
4. **Prefetching**: Prefetch dispatch data when hovering over PO row

---

## 10. Recommended Improvements to Implementation Doc

Add these sections to `DISPATCH_API_IMPLEMENTATION.md`:

1. **Error Response Format Specification**
2. **API Response Format Examples**
3. **Testing Checklist**
4. **Performance Considerations**
5. **Frontend Integration Notes**

---

## Conclusion

The backend implementation plan is solid and follows best practices. The main work is:

1. **Backend**: Implement as documented (with minor clarifications)
2. **Frontend**: Migrate from Redux slice to RTK Query APIs
3. **Types**: Share types between frontend/backend (start with manual, plan for shared package)
4. **Testing**: Comprehensive testing at each layer
5. **Rollout**: Gradual migration with rollback plan

**Estimated Timeline:**

- Backend Implementation: 3-5 days
- Frontend Integration: 2-3 days
- Testing & Bug Fixes: 2-3 days
- **Total: 7-11 days**
