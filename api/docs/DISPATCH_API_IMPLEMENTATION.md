# Dispatch API Implementation Guide

## Overview

This document outlines the complete implementation plan for the Dispatch API backend. The Dispatch section has three subsections:

1. **Dispatch Details** (Create) - Initial dispatch information
2. **Update Documents** (Update) - Dispatch document details
3. **Delivery Confirmation** (Update) - Delivery confirmation details

### Key Requirements

- One PO can have multiple dispatches
- All dispatch IDs should be **numbers** (auto-increment)
- Follow Controller-Service-Repository (CSR) pattern
- Use Prisma ORM for database operations
- Use Inversify for dependency injection
- All APIs must return standardized responses with pagination where applicable

---

## Database Schema

### Tables Required

We need **2 new tables**:

1. **`dispatches`** - Main dispatch table
2. **`dispatched_items`** - Items dispatched in each dispatch (many-to-many relationship)

### Prisma Schema Models

Add the following models to `api/layers/shared/nodejs/prisma/schema.prisma`:

```prisma
model Dispatch {
  dispatchId              Int                   @id @default(autoincrement()) @map("dispatch_id")
  poId                    String                @map("po_id") @db.VarChar(20)
  purchaseOrder           PurchaseOrder         @relation(fields: [poId], references: [poId], onDelete: Cascade)

  // Dispatch Details Fields (Section 1)
  projectName             String                @map("project_name") @db.VarChar(255)
  projectLocation         String                @map("project_location") @db.VarChar(255)
  deliveryLocation        String                @map("delivery_location") @db.VarChar(255)
  deliveryAddress         String                @map("delivery_address") @db.Text
  googleMapLink           String?               @map("google_map_link") @db.VarChar(500)
  confirmDispatchDate     DateTime              @map("confirm_dispatch_date") @db.Date
  deliveryContact         String                @map("delivery_contact") @db.VarChar(100)
  remarks                 String?               @db.Text

  // Document Fields (Section 2 - Optional)
  noDuesClearance         String?               @map("no_dues_clearance") @db.VarChar(50)
  docOsgPiNo              String?               @map("doc_osg_pi_no") @db.VarChar(50)
  docOsgPiDate            DateTime?             @map("doc_osg_pi_date") @db.Date
  taxInvoiceNumber        String?               @map("tax_invoice_number") @db.VarChar(100)
  invoiceDate             DateTime?             @map("invoice_date") @db.Date
  ewayBill                String?               @map("eway_bill") @db.VarChar(100)
  deliveryChallan         String?               @map("delivery_challan") @db.VarChar(100)
  dispatchDate            DateTime?             @map("dispatch_date") @db.Date
  packagingList           String?               @map("packaging_list") @db.Text
  dispatchFromLocation    String?               @map("dispatch_from_location") @db.VarChar(255)
  dispatchStatus          String?               @map("dispatch_status") @db.VarChar(50)
  dispatchLrNo            String?               @map("dispatch_lr_no") @db.VarChar(100)
  dispatchRemarks         String?               @map("dispatch_remarks") @db.Text
  documentUpdatedAt       DateTime?             @map("document_updated_at")

  // Delivery Confirmation Fields (Section 3 - Optional)
  dateOfDelivery          DateTime?             @map("date_of_delivery") @db.Date
  deliveryStatus          String?               @map("delivery_status") @db.VarChar(50)
  proofOfDelivery         String?               @map("proof_of_delivery") @db.Text
  deliveryUpdatedAt       DateTime?             @map("delivery_updated_at")

  // Audit Fields
  createdById             Int?                  @map("created_by")
  createdBy               User?                 @relation("DispatchCreatedBy", fields: [createdById], references: [userId], onDelete: SetNull)
  updatedById             Int?                  @map("updated_by")
  updatedBy               User?                 @relation("DispatchUpdatedBy", fields: [updatedById], references: [userId], onDelete: SetNull)
  createdAt               DateTime              @default(now()) @map("created_at")
  updatedAt               DateTime              @updatedAt @map("updated_at")

  // Relations
  dispatchedItems         DispatchedItem[]
  preCommissionings       PreCommissioning[]

  @@index([poId])
  @@index([dispatchStatus])
  @@index([deliveryStatus])
  @@index([createdAt])
  @@map("dispatches")
}

model DispatchedItem {
  id                      Int                   @id @default(autoincrement())
  dispatchId              Int                   @map("dispatch_id")
  dispatch                Dispatch              @relation(fields: [dispatchId], references: [dispatchId], onDelete: Cascade)
  productId               Int                   @map("product_id")
  product                 Product               @relation(fields: [productId], references: [productId], onDelete: Restrict)
  quantity                Int
  serialNumbers           String?               @map("serial_numbers") @db.Text // Comma-separated serial numbers

  createdAt               DateTime              @default(now()) @map("created_at")
  updatedAt               DateTime              @updatedAt @map("updated_at")

  @@index([dispatchId])
  @@index([productId])
  @@map("dispatched_items")
}
```

### Update Existing Models

#### Update `PurchaseOrder` model:

Add the dispatch relation:

```prisma
model PurchaseOrder {
  // ... existing fields ...
  dispatches              Dispatch[]
  // ... rest of fields ...
}
```

#### Update `Product` model:

Add the dispatched items relation:

```prisma
model Product {
  // ... existing fields ...
  dispatchedItems         DispatchedItem[]
  // ... rest of fields ...
}
```

#### Update `User` model:

Add dispatch relations for audit fields:

```prisma
model User {
  // ... existing fields ...
  dispatchesCreated       Dispatch[]            @relation("DispatchCreatedBy")
  dispatchesUpdated       Dispatch[]            @relation("DispatchUpdatedBy")
  // ... rest of fields ...
}
```

---

## Constants

Create a new file: `api/src/constants/dispatchConstants.ts`

```typescript
/**
 * Dispatch Status Options
 */
export const DISPATCH_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type DispatchStatus = (typeof DISPATCH_STATUS)[keyof typeof DISPATCH_STATUS];

export const DISPATCH_STATUS_OPTIONS = [
  { value: DISPATCH_STATUS.DONE, label: 'Done' },
  { value: DISPATCH_STATUS.PENDING, label: 'Pending' },
  { value: DISPATCH_STATUS.HOLD, label: 'Hold' },
  { value: DISPATCH_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * Delivery Status Options
 */
export const DELIVERY_STATUS = {
  DONE: 'done',
  PENDING: 'pending',
  HOLD: 'hold',
  CANCELLED: 'cancelled',
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const DELIVERY_STATUS_OPTIONS = [
  { value: DELIVERY_STATUS.DONE, label: 'Done' },
  { value: DELIVERY_STATUS.PENDING, label: 'Pending' },
  { value: DELIVERY_STATUS.HOLD, label: 'Hold' },
  { value: DELIVERY_STATUS.CANCELLED, label: 'Cancelled' },
];

/**
 * No Dues Clearance Options
 */
export const NO_DUES_CLEARANCE = {
  PENDING: 'pending',
  CLEARED: 'cleared',
  NOT_REQUIRED: 'not_required',
} as const;

export type NoDuesClearance = (typeof NO_DUES_CLEARANCE)[keyof typeof NO_DUES_CLEARANCE];

export const NO_DUES_CLEARANCE_OPTIONS = [
  { value: NO_DUES_CLEARANCE.PENDING, label: 'Pending' },
  { value: NO_DUES_CLEARANCE.CLEARED, label: 'Cleared' },
  { value: NO_DUES_CLEARANCE.NOT_REQUIRED, label: 'Not Required' },
];
```

---

## API Endpoints

### Dispatch Controller Endpoints

All endpoints are under `/api/dispatch`:

| Method | Endpoint          | Description                          | Section |
| ------ | ----------------- | ------------------------------------ | ------- |
| POST   | `/`               | Create dispatch details              | 1       |
| GET    | `/`               | Get all dispatches (with pagination) | -       |
| GET    | `/po/{poId}`      | Get all dispatches by PO ID          | -       |
| GET    | `/{id}`           | Get dispatch by ID                   | -       |
| PUT    | `/{id}`           | Update dispatch details              | 1       |
| PUT    | `/{id}/documents` | Update dispatch documents            | 2       |
| PUT    | `/{id}/delivery`  | Update delivery confirmation         | 3       |
| DELETE | `/{id}`           | Delete dispatch                      | -       |

---

## Request/Response Schemas

### Request Schemas

Create: `api/src/schemas/request/DispatchRequest.ts`

```typescript
import { BaseListRequest } from './BaseListRequest';

/**
 * Dispatched Item Request
 */
export interface DispatchedItemRequest {
  productId: number;
  quantity: number;
  serialNumbers?: string; // Comma-separated serial numbers
}

/**
 * Create Dispatch Request (Section 1: Dispatch Details)
 */
export interface CreateDispatchRequest {
  poId: string;
  dispatchedItems: DispatchedItemRequest[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string; // YYYY-MM-DD format
  deliveryContact: string;
  remarks?: string;
  createdById?: number;
  updatedById?: number;
}

/**
 * Update Dispatch Details Request (Section 1)
 */
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
  updatedById?: number;
}

/**
 * Update Dispatch Documents Request (Section 2)
 */
export interface UpdateDispatchDocumentsRequest {
  noDuesClearance?: string;
  docOsgPiNo?: string;
  docOsgPiDate?: string; // YYYY-MM-DD format
  taxInvoiceNumber?: string;
  invoiceDate?: string; // YYYY-MM-DD format
  ewayBill?: string;
  deliveryChallan?: string;
  dispatchDate?: string; // YYYY-MM-DD format
  packagingList?: string;
  dispatchFromLocation?: string;
  dispatchStatus?: string;
  dispatchLrNo?: string;
  dispatchRemarks?: string;
  updatedById?: number;
}

/**
 * Update Delivery Confirmation Request (Section 3)
 */
export interface UpdateDeliveryConfirmationRequest {
  dateOfDelivery?: string; // YYYY-MM-DD format
  deliveryStatus?: string;
  proofOfDelivery?: string;
  updatedById?: number;
}

/**
 * List Dispatch Request
 */
export interface ListDispatchRequest extends BaseListRequest {
  poId?: string;
  dispatchStatus?: string;
  deliveryStatus?: string;
}
```

### Response Schemas

Create: `api/src/schemas/response/DispatchResponse.ts`

```typescript
/**
 * Dispatched Item Response
 */
export interface DispatchedItemResponse {
  id: number;
  productId: number;
  productName?: string; // Resolved from relation
  quantity: number;
  serialNumbers?: string;
}

/**
 * Dispatch Response
 */
export interface DispatchResponse {
  dispatchId: number;
  poId: string;

  // Dispatch Details (Section 1)
  dispatchedItems: DispatchedItemResponse[];
  projectName: string;
  projectLocation: string;
  deliveryLocation: string;
  deliveryAddress: string;
  googleMapLink?: string;
  confirmDispatchDate: string;
  deliveryContact: string;
  remarks?: string;

  // Document Fields (Section 2)
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

  // Delivery Confirmation Fields (Section 3)
  dateOfDelivery?: string;
  deliveryStatus?: string;
  proofOfDelivery?: string;
  deliveryUpdatedAt?: string;

  // Audit Fields
  createdById?: number;
  createdBy?: string; // Username
  updatedById?: number;
  updatedBy?: string; // Username
  createdAt: string;
  updatedAt: string;
}

/**
 * Dispatch List Response
 */
export interface DispatchListResponse {
  data: DispatchResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Delete Dispatch Response
 */
export interface DeleteDispatchResponse {
  dispatchId: number;
  deleted: boolean;
}
```

Update: `api/src/schemas/index.ts`

```typescript
// ... existing exports ...
export * from './request/DispatchRequest';
export * from './response/DispatchResponse';
```

---

## Repository Interface

Create: `api/src/repositories/DispatchRepository.ts`

```typescript
import { PrismaClient, Dispatch, DispatchedItem } from '@prisma/client';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
} from '../schemas/request/DispatchRequest';

export interface DispatchWithRelations extends Dispatch {
  purchaseOrder?: {
    poId: string;
    clientName?: string;
  };
  dispatchedItems?: (DispatchedItem & {
    product?: {
      productId: number;
      productName: string;
    };
  })[];
  createdBy?: {
    userId: number;
    username: string;
  };
  updatedBy?: {
    userId: number;
    username: string;
  };
}

export interface IDispatchRepository {
  create(data: CreateDispatchRequest): Promise<DispatchWithRelations>;
  findById(dispatchId: number): Promise<DispatchWithRelations | null>;
  findAll(params: ListDispatchRequest): Promise<{ rows: DispatchWithRelations[]; count: number }>;
  findByPoId(poId: string): Promise<DispatchWithRelations[]>;
  updateDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchWithRelations | null>;
  updateDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchWithRelations | null>;
  updateDelivery(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchWithRelations | null>;
  delete(dispatchId: number): Promise<boolean>;
}
```

---

## Service Interface

Create: `api/src/services/DispatchService.ts`

```typescript
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
  ListDispatchRequest,
  DispatchResponse,
  DispatchListResponse,
} from '../schemas';

export interface IDispatchService {
  createDispatch(data: CreateDispatchRequest): Promise<DispatchResponse>;
  getDispatchById(dispatchId: number): Promise<DispatchResponse | null>;
  getAllDispatches(params: ListDispatchRequest): Promise<DispatchListResponse>;
  getDispatchesByPoId(poId: string): Promise<DispatchResponse[]>;
  updateDispatchDetails(
    dispatchId: number,
    data: UpdateDispatchDetailsRequest
  ): Promise<DispatchResponse | null>;
  updateDispatchDocuments(
    dispatchId: number,
    data: UpdateDispatchDocumentsRequest
  ): Promise<DispatchResponse | null>;
  updateDeliveryConfirmation(
    dispatchId: number,
    data: UpdateDeliveryConfirmationRequest
  ): Promise<DispatchResponse | null>;
  deleteDispatch(dispatchId: number): Promise<boolean>;
}
```

---

## Controller Interface

Create: `api/src/controllers/DispatchController.ts`

```typescript
import { APIGatewayProxyResult } from 'aws-lambda';
import { JWTPayload } from '@arcforge/shared';
import {
  CreateDispatchRequest,
  UpdateDispatchDetailsRequest,
  UpdateDispatchDocumentsRequest,
  UpdateDeliveryConfirmationRequest,
} from '../schemas/request/DispatchRequest';

export interface IDispatchController {
  create(data: CreateDispatchRequest, currentUser?: JWTPayload): Promise<APIGatewayProxyResult>;
  getAll(params: any): Promise<APIGatewayProxyResult>;
  getByPoId(poId: string): Promise<APIGatewayProxyResult>;
  getById(id: string): Promise<APIGatewayProxyResult>;
  updateDetails(
    id: string,
    data: UpdateDispatchDetailsRequest,
    currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateDocuments(
    id: string,
    data: UpdateDispatchDocumentsRequest,
    currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  updateDelivery(
    id: string,
    data: UpdateDeliveryConfirmationRequest,
    currentUser?: JWTPayload
  ): Promise<APIGatewayProxyResult>;
  delete(id: string): Promise<APIGatewayProxyResult>;
}
```

---

## Step-by-Step Implementation Guide

### Step 1: Update Prisma Schema

1. Open `api/layers/shared/nodejs/prisma/schema.prisma`
2. Add the `Dispatch` and `DispatchedItem` models as specified above
3. Update `PurchaseOrder`, `Product`, and `User` models with new relations
4. Run migration:
   ```bash
   cd api/layers/shared/nodejs
   npx prisma migrate dev --name add_dispatch_tables
   npx prisma generate
   ```

### Step 2: Create Constants

1. Create `api/src/constants/dispatchConstants.ts` with the constants defined above
2. Export from `api/src/constants/index.ts` (create if doesn't exist):
   ```typescript
   export * from './dispatchConstants';
   ```

### Step 3: Create Request Schemas

1. Create `api/src/schemas/request/DispatchRequest.ts`
2. Add all request interfaces as defined above
3. Update `api/src/schemas/index.ts` to export the new request schemas

### Step 4: Create Response Schemas

1. Create `api/src/schemas/response/DispatchResponse.ts`
2. Add all response interfaces as defined above
3. Update `api/src/schemas/index.ts` to export the new response schemas

### Step 5: Create Repository

1. Create `api/src/repositories/DispatchRepository.ts`
2. Implement `IDispatchRepository` interface
3. Use Prisma Client for all database operations
4. Include proper relations in queries (dispatchedItems, etc.)

### Step 6: Create Service

1. Create `api/src/services/DispatchService.ts`
2. Implement `IDispatchService` interface
3. Inject `IDispatchRepository` using Inversify
4. Implement mapping logic from Prisma models to response schemas
5. Handle business logic (validation, transactions, etc.)
6. Use Prisma transactions for operations involving multiple tables

### Step 7: Create Controller

1. Create `api/src/controllers/DispatchController.ts`
2. Implement `IDispatchController` interface
3. Use decorators: `@Controller({ path: '/api/dispatch', lambdaName: 'dispatch' })`
4. Add route handlers with appropriate decorators (`@Post`, `@Get`, `@Put`, `@Delete`)
5. Inject `IDispatchService` using Inversify
6. Handle request validation and response formatting
7. Use `@CurrentUser()` decorator for audit fields (createdById, updatedById)

### Step 8: Update Types

1. Open `api/src/types/types.ts`
2. Add new symbols:
   ```typescript
   export const TYPES = {
     // ... existing types ...
     DispatchController: Symbol.for('DispatchController'),
     DispatchService: Symbol.for('DispatchService'),
     DispatchRepository: Symbol.for('DispatchRepository'),
   };
   ```

### Step 9: Create Lambda Configuration

1. Create `api/src/lambdas/dispatch.lambda.ts`
2. Follow the pattern from existing lambda files (e.g., `po.lambda.ts`)
3. Register `DispatchController`, `DispatchService`, and `DispatchRepository` in bindings
4. Import and register the controller in the controllers array

### Step 10: Update Controller Index

1. Open `api/src/controllers/index.ts`
2. Export the new controller:
   ```typescript
   export * from './DispatchController';
   ```

### Step 11: Testing

1. Test all endpoints using API Gateway or Postman
2. Verify:
   - Create dispatch details
   - Update documents
   - Update delivery confirmation
   - Get all dispatches
   - Get dispatches by PO ID
   - Get dispatch by ID
   - Delete dispatch
3. Verify relations are properly loaded
4. Verify pagination works correctly
5. Verify audit fields are set correctly

---

## Implementation Notes

### Transactions

- Use Prisma transactions for operations that involve multiple tables (e.g., creating dispatch with dispatched items)
- Wrap related operations in `prisma.$transaction()`

### Date Format

- All date fields should be in `YYYY-MM-DD` format in requests
- Convert to `Date` objects for database storage
- Convert back to `YYYY-MM-DD` format in responses

### Serial Numbers

- Serial numbers are stored as comma-separated strings in the database
- Frontend should validate that the count matches the quantity

### Validation

- Validate that `poId` exists before creating dispatch
- Validate that `productId` exists for each dispatched item
- Validate status values against constants
- Validate required fields for each section

### Error Handling

- Return appropriate HTTP status codes (200, 201, 400, 404, 500)
- Return meaningful error messages
- Use `ValidationError` from `@arcforge/shared` for validation errors

---

## API Response Format

All APIs must return responses in the following format:

### Success Response

```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "data": { ... },
    "pagination": { ... } // Only for list endpoints
  }
}
```

### Error Response

```json
{
  "statusCode": 400,
  "body": {
    "success": false,
    "error": {
      "message": "Error message",
      "code": "ERROR_CODE"
    }
  }
}
```

---

## Next Steps

1. Review and approve this document
2. Implement database schema changes
3. Create constants
4. Create schemas
5. Implement repository
6. Implement service
7. Implement controller
8. Create lambda configuration
9. Test all endpoints
10. Update frontend to use new APIs

---

## References

- [Project Architecture](./ARCHITECTURE.md)
- [Database Guide](./DATABASE.md)
- [Creating New Lambda](./CREATING_NEW_LAMBDA.md)
- [PO Controller Implementation](../src/controllers/POController.ts)
- [PO Service Implementation](../src/services/POService.ts)
- [PO Repository Implementation](../src/repositories/PORepository.ts)
