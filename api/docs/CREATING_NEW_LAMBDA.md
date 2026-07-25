# Creating a New Lambda - Complete Guide

This comprehensive guide explains how to create a new Lambda function and API endpoints in the ArcForge CloudArc API. It is designed for new team members and beginners.

---

## Table of Contents

1. [Introduction](#introduction)
2. [Key Concepts](#key-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Prerequisites](#prerequisites)
5. [Step-by-Step Guide](#step-by-step-guide)
6. [File Structure Summary](#file-structure-summary)
7. [Quick Checklist](#quick-checklist)
8. [Testing Your Lambda](#testing-your-lambda)
9. [Local Development](#local-development)
10. [Available Decorators](#available-decorators)
11. [Common Patterns](#common-patterns)
12. [Troubleshooting](#troubleshooting)
13. [FAQ](#faq)

---

## Introduction

### What is this project?

The ArcForge CloudArc API is a serverless backend built on AWS Lambda. Each Lambda function handles a specific domain (e.g., Purchase Orders, Dispatches, Inventory) and exposes REST API endpoints.

### What will you learn?

By following this guide, you will learn how to:
- Create a complete CRUD (Create, Read, Update, Delete) API
- Work with the database using Prisma ORM
- Use dependency injection with Inversify
- Follow the Controller-Service-Repository pattern

---

## Key Concepts

Before you start, understand these key terms:

### Lambda Function
A serverless function that runs in AWS. It starts when an API request comes in and stops after responding. You don't manage servers - AWS handles everything.

### Controller
Handles incoming HTTP requests. It:
- Receives the request (GET, POST, PUT, DELETE)
- Extracts parameters from URL, query string, or body
- Calls the appropriate service method
- Returns the response

### Service
Contains business logic. It:
- Validates data
- Orchestrates operations
- Transforms data between formats
- Calls repository methods

### Repository
Handles database operations. It:
- Creates, reads, updates, deletes records
- Builds database queries
- Returns raw database results

### Schema
TypeScript interfaces that define the shape of:
- **Request schemas**: What data the API expects from clients
- **Response schemas**: What data the API returns to clients

### Prisma
An ORM (Object-Relational Mapping) tool that:
- Defines database tables in a schema file
- Generates TypeScript types automatically
- Provides type-safe database queries

### Dependency Injection (DI)
A pattern where dependencies (like services, repositories) are "injected" into classes rather than created inside them. This makes code testable and loosely coupled.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              API Gateway                                 │
│                    (Routes HTTP requests to Lambda)                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Lambda Function                                │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Controller(s)                                 │   │
│  │   • One or more controllers per Lambda                           │   │
│  │   • Receives HTTP request                                        │   │
│  │   • Extracts @Body, @Param, @Query                              │   │
│  │   • Returns HTTP response                                        │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                         Service(s)                               │   │
│  │   • Business logic                                               │   │
│  │   • Data validation                                              │   │
│  │   • Response transformation                                      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                     │
│                                    ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Repository(ies)                           │   │
│  │   • Database queries (Prisma)                                    │   │
│  │   • CRUD operations                                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         PostgreSQL Database                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Single vs Multi-Controller Lambdas

You can organize your code in two ways:

**Single Controller Lambda** (recommended for simple domains):
```
Lambda: dispatch
└── DispatchController → DispatchService → DispatchRepository
```

**Multi-Controller Lambda** (recommended for related functionality):
```
Lambda: admin
├── UserController       → UserService       → UserRepository
├── RoleController       → RoleService       → RoleRepository
└── PermissionController → PermissionService → PermissionRepository
```

Multi-controller lambdas help reduce the number of Lambda functions while keeping code organized. Use this pattern when:
- Multiple functionalities are closely related (e.g., admin operations)
- You want to share cold start costs across related endpoints
- The combined code size stays within Lambda limits (250MB)

### Request Flow Example

```
1. Client sends: POST /api/dispatch { "poId": "123", "carrier": "FedEx" }
                           │
                           ▼
2. API Gateway routes to dispatch Lambda
                           │
                           ▼
3. DispatchController.create() receives request
   - @Body() extracts the JSON body
                           │
                           ▼
4. DispatchService.createDispatch() is called
   - Validates data
   - Prepares data for database
                           │
                           ▼
5. DispatchRepository.create() saves to database
   - Uses Prisma to insert record
                           │
                           ▼
6. Response flows back up through Service → Controller
                           │
                           ▼
7. Client receives: { "id": "abc", "poId": "123", "carrier": "FedEx", ... }
```

---

## Prerequisites

### 1. Install Required Software

| Software | Version | Download Link |
|----------|---------|---------------|
| Node.js | 22.x or later | [nodejs.org](https://nodejs.org/) |
| PostgreSQL | 15+ | [postgresql.org](https://www.postgresql.org/download/) or use Docker |
| Git | Latest | [git-scm.com](https://git-scm.com/) |
| VS Code | Latest | [code.visualstudio.com](https://code.visualstudio.com/) |

### 2. Recommended VS Code Extensions

- **Prisma** - Syntax highlighting for .prisma files
- **ESLint** - JavaScript/TypeScript linting
- **Prettier** - Code formatting
- **REST Client** or **Thunder Client** - Test API endpoints

### 3. Project Setup

```bash
# Clone the repository (if not already done)
git clone <repository-url>
cd arcforge-order-tracking

# Install root dependencies
npm install

# Install API dependencies
cd api
npm install

# Build the shared layer
npm run build:layer

# Generate Prisma client
npm run db:generate

# Build the API
npm run build
```

### 4. Database Setup

For local development, set up a PostgreSQL database:

```bash
# Using Docker (recommended)
docker run --name arcforge-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=arcforge -p 5432:5432 -d postgres:15

# Or install PostgreSQL locally and create database:
# CREATE DATABASE arcforge;
```

Create a `.env` file in the `api` folder:

```env
IS_LOCAL=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arcforge
DB_USERNAME=postgres
DB_PASSWORD=postgres
```

Run migrations to create tables:

```bash
npm run db:migrate
```

---

## Step-by-Step Guide

Let's create a **Dispatch** Lambda that manages shipment dispatches for purchase orders.

### Step 1: Plan Your API

Before writing code, plan your endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/dispatch` | Create a new dispatch |
| GET | `/api/dispatch` | List all dispatches (with pagination) |
| GET | `/api/dispatch/{id}` | Get dispatch by ID |
| PUT | `/api/dispatch/{id}` | Update a dispatch |
| DELETE | `/api/dispatch/{id}` | Delete a dispatch |

### Step 2: Create Schema Files

Schemas define the data structure for requests and responses.

#### 2.1 Create Request Schema

Create the file `src/schemas/request/DispatchRequest.ts`:

```typescript
/**
 * Request schema for creating a new dispatch
 * All required fields must be provided by the client
 */
export interface CreateDispatchRequest {
  /** ID of the purchase order this dispatch belongs to */
  poId: string;
  
  /** Date of dispatch in YYYY-MM-DD format */
  dispatchDate: string;
  
  /** Carrier/shipping company name */
  carrier: string;
  
  /** Optional tracking number */
  trackingNumber?: string;
}

/**
 * Request schema for updating a dispatch
 * All fields are optional - only provided fields will be updated
 */
export interface UpdateDispatchRequest {
  dispatchDate?: string;
  carrier?: string;
  trackingNumber?: string;
  status?: 'pending' | 'shipped' | 'delivered' | 'cancelled';
}

/**
 * Request schema for listing dispatches with filters
 */
export interface ListDispatchRequest {
  /** Page number (starts from 1) */
  page?: number;
  
  /** Number of items per page */
  limit?: number;
  
  /** Filter by purchase order ID */
  poId?: string;
  
  /** Filter by status */
  status?: string;
}
```

#### 2.2 Create Response Schema

Create the file `src/schemas/response/DispatchResponse.ts`:

```typescript
/**
 * Response schema for a single dispatch
 */
export interface DispatchResponse {
  id: string;
  poId: string;
  dispatchDate: string;
  carrier: string;
  trackingNumber: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Response schema for paginated dispatch list
 */
export interface DispatchListResponse {
  items: DispatchResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

#### 2.3 Export Schemas

Update `src/schemas/index.ts` to export your new schemas:

```typescript
// Request schemas
export * from './request/PORequest';
export * from './request/DispatchRequest';  // ← Add this line

// Response schemas
export * from './response/POResponse';
export * from './response/DispatchResponse';  // ← Add this line
```

### Step 3: Add Prisma Model (Database Table)

If your Lambda needs a new database table, add it to the Prisma schema.

Edit `layers/shared/nodejs/prisma/schema.prisma`:

```prisma
// Add this model after the existing models

model Dispatch {
  id              String        @id @default(uuid())
  purchaseOrderId String        @map("purchase_order_id")
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id])
  dispatchDate    DateTime      @map("dispatch_date") @db.Date
  carrier         String        @db.VarChar(100)
  trackingNumber  String?       @map("tracking_number") @db.VarChar(100)
  status          String        @default("pending") @db.VarChar(50)
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  @@index([purchaseOrderId])
  @@index([status])
  @@map("dispatches")
}
```

> **Important:** Also add the relation to the PurchaseOrder model:
> ```prisma
> model PurchaseOrder {
>   // ... existing fields ...
>   dispatches        Dispatch[]  // ← Add this line
> }
> ```

Run these commands to apply changes:

```bash
# Create migration and update database
npm run db:migrate
# When prompted, enter a name like: add-dispatch-table

# Regenerate Prisma client with new types
npm run db:generate
```

### Step 4: Create Repository

The repository handles all database operations.

Create `src/repositories/DispatchRepository.ts`:

```typescript
import { injectable, inject } from 'inversify';
import { PrismaClient, Dispatch, Prisma } from '@prisma/client';
import { TYPES } from '../types/types';
import { CreateDispatchRequest, UpdateDispatchRequest, ListDispatchRequest } from '../schemas';

/**
 * Interface defining repository methods
 * This allows for easy mocking in tests
 */
export interface IDispatchRepository {
  create(data: CreateDispatchRequest): Promise<Dispatch>;
  findById(id: string): Promise<Dispatch | null>;
  findAll(params: ListDispatchRequest): Promise<{ rows: Dispatch[]; count: number }>;
  update(id: string, data: UpdateDispatchRequest): Promise<Dispatch | null>;
  delete(id: string): Promise<boolean>;
}

/**
 * Repository for Dispatch database operations
 * 
 * @injectable() - Marks this class for dependency injection
 */
@injectable()
export class DispatchRepository implements IDispatchRepository {
  /**
   * Constructor with dependency injection
   * @inject(TYPES.PrismaClient) - Injects the Prisma client
   */
  constructor(@inject(TYPES.PrismaClient) private prisma: PrismaClient) {}

  /**
   * Create a new dispatch record
   */
  async create(data: CreateDispatchRequest): Promise<Dispatch> {
    return this.prisma.dispatch.create({
      data: {
        purchaseOrderId: data.poId,
        dispatchDate: new Date(data.dispatchDate),
        carrier: data.carrier,
        trackingNumber: data.trackingNumber || null,
        status: 'pending',
      },
    });
  }

  /**
   * Find a dispatch by its ID
   * Returns null if not found
   */
  async findById(id: string): Promise<Dispatch | null> {
    return this.prisma.dispatch.findUnique({
      where: { id },
    });
  }

  /**
   * Find all dispatches with pagination and filters
   */
  async findAll(params: ListDispatchRequest): Promise<{ rows: Dispatch[]; count: number }> {
    const { page = 1, limit = 10, poId, status } = params;
    const skip = (page - 1) * limit;

    // Build dynamic where clause based on filters
    const where: Prisma.DispatchWhereInput = {};
    if (poId) where.purchaseOrderId = poId;
    if (status) where.status = status;

    // Execute both queries in a transaction for consistency
    const [rows, count] = await this.prisma.$transaction([
      this.prisma.dispatch.findMany({
        where,
        take: limit,
        skip,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.dispatch.count({ where }),
    ]);

    return { rows, count };
  }

  /**
   * Update a dispatch record
   * Returns null if dispatch not found
   */
  async update(id: string, data: UpdateDispatchRequest): Promise<Dispatch | null> {
    // Check if exists first
    const existing = await this.prisma.dispatch.findUnique({ where: { id } });
    if (!existing) return null;

    // Build update object with only provided fields
    return this.prisma.dispatch.update({
      where: { id },
      data: {
        ...(data.dispatchDate && { dispatchDate: new Date(data.dispatchDate) }),
        ...(data.carrier && { carrier: data.carrier }),
        ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
        ...(data.status && { status: data.status }),
      },
    });
  }

  /**
   * Delete a dispatch record
   * Returns true if deleted, false if not found
   */
  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.dispatch.delete({ where: { id } });
      return true;
    } catch {
      // Record not found or other error
      return false;
    }
  }
}
```

### Step 5: Create Service

The service contains business logic and transforms data.

Create `src/services/DispatchService.ts`:

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../types/types';
import { IDispatchRepository } from '../repositories/DispatchRepository';
import {
  CreateDispatchRequest,
  UpdateDispatchRequest,
  ListDispatchRequest,
  DispatchResponse,
  DispatchListResponse,
} from '../schemas';

/**
 * Interface defining service methods
 */
export interface IDispatchService {
  createDispatch(data: CreateDispatchRequest): Promise<DispatchResponse>;
  getDispatchById(id: string): Promise<DispatchResponse | null>;
  getAllDispatches(params: ListDispatchRequest): Promise<DispatchListResponse>;
  updateDispatch(id: string, data: UpdateDispatchRequest): Promise<DispatchResponse | null>;
  deleteDispatch(id: string): Promise<boolean>;
}

/**
 * Service for Dispatch business logic
 */
@injectable()
export class DispatchService implements IDispatchService {
  constructor(
    @inject(TYPES.DispatchRepository) private repository: IDispatchRepository
  ) {}

  /**
   * Create a new dispatch
   */
  async createDispatch(data: CreateDispatchRequest): Promise<DispatchResponse> {
    const dispatch = await this.repository.create(data);
    return this.mapToResponse(dispatch);
  }

  /**
   * Get a dispatch by ID
   */
  async getDispatchById(id: string): Promise<DispatchResponse | null> {
    const dispatch = await this.repository.findById(id);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Get all dispatches with pagination
   */
  async getAllDispatches(params: ListDispatchRequest): Promise<DispatchListResponse> {
    const { page = 1, limit = 10 } = params;
    const { rows, count } = await this.repository.findAll(params);

    return {
      items: rows.map((d) => this.mapToResponse(d)),
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  /**
   * Update a dispatch
   */
  async updateDispatch(
    id: string,
    data: UpdateDispatchRequest
  ): Promise<DispatchResponse | null> {
    const dispatch = await this.repository.update(id, data);
    return dispatch ? this.mapToResponse(dispatch) : null;
  }

  /**
   * Delete a dispatch
   */
  async deleteDispatch(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  /**
   * Map database model to response schema
   * This separates internal data structure from API response
   */
  private mapToResponse(dispatch: any): DispatchResponse {
    return {
      id: dispatch.id,
      poId: dispatch.purchaseOrderId,
      dispatchDate: dispatch.dispatchDate.toISOString().split('T')[0],
      carrier: dispatch.carrier,
      trackingNumber: dispatch.trackingNumber,
      status: dispatch.status,
      createdAt: dispatch.createdAt.toISOString(),
      updatedAt: dispatch.updatedAt.toISOString(),
    };
  }
}
```

### Step 6: Create Controller

The controller handles HTTP requests and responses.

Create `src/controllers/DispatchController.ts`:

```typescript
import 'reflect-metadata';
import { injectable, inject } from 'inversify';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  createSuccessResponse,
  NotFoundError,
  ValidationError,
} from '@arcforge/shared';
import { TYPES } from '../types/types';
import { IDispatchService } from '../services/DispatchService';
import { CreateDispatchRequest, UpdateDispatchRequest } from '../schemas';

/**
 * Controller for Dispatch API endpoints
 * 
 * @Controller - Decorator that registers this as a controller
 *   - path: Base URL path for all endpoints in this controller
 *   - lambdaName: Name used for Lambda function and routing
 */
@Controller({ path: '/api/dispatch', lambdaName: 'dispatch' })
@injectable()
export class DispatchController {
  constructor(
    @inject(TYPES.DispatchService) private dispatchService: IDispatchService
  ) {}

  /**
   * POST /api/dispatch
   * Create a new dispatch
   * 
   * @Body() - Extracts and parses JSON request body
   */
  @Post('/')
  async create(@Body() data: CreateDispatchRequest): Promise<APIGatewayProxyResult> {
    // Validate required fields
    if (!data.poId) {
      throw new ValidationError('poId is required');
    }
    if (!data.dispatchDate) {
      throw new ValidationError('dispatchDate is required');
    }
    if (!data.carrier) {
      throw new ValidationError('carrier is required');
    }

    const dispatch = await this.dispatchService.createDispatch(data);
    return createSuccessResponse(dispatch, 201); // 201 = Created
  }

  /**
   * GET /api/dispatch
   * List all dispatches with optional filters
   * 
   * @Query('name') - Extracts query parameter from URL
   * Example: GET /api/dispatch?page=1&limit=10&status=pending
   */
  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('poId') poId?: string,
    @Query('status') status?: string
  ): Promise<APIGatewayProxyResult> {
    const result = await this.dispatchService.getAllDispatches({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
      poId,
      status,
    });
    return createSuccessResponse(result.items, 200, result.pagination);
  }

  /**
   * GET /api/dispatch/{id}
   * Get a specific dispatch by ID
   * 
   * @Param('id') - Extracts path parameter from URL
   * Example: GET /api/dispatch/abc-123-def
   */
  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const dispatch = await this.dispatchService.getDispatchById(id);
    
    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }
    
    return createSuccessResponse(dispatch);
  }

  /**
   * PUT /api/dispatch/{id}
   * Update a dispatch
   * 
   * Combines @Param for ID and @Body for update data
   */
  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdateDispatchRequest
  ): Promise<APIGatewayProxyResult> {
    const dispatch = await this.dispatchService.updateDispatch(id, data);
    
    if (!dispatch) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }
    
    return createSuccessResponse(dispatch);
  }

  /**
   * DELETE /api/dispatch/{id}
   * Delete a dispatch
   */
  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const deleted = await this.dispatchService.deleteDispatch(id);
    
    if (!deleted) {
      throw new NotFoundError(`Dispatch with ID ${id} not found`);
    }
    
    return createSuccessResponse({ id, deleted: true });
  }
}
```

### Step 7: Register Types (Dependency Injection Symbols)

Add symbols for your new services in `src/types/types.ts`:

```typescript
export const TYPES = {
  // Existing symbols
  POController: Symbol.for('POController'),
  POService: Symbol.for('POService'),
  PORepository: Symbol.for('PORepository'),
  PrismaClient: Symbol.for('PrismaClient'),

  // ========================================
  // Add your new symbols below this line
  // ========================================
  
  // Dispatch
  DispatchController: Symbol.for('DispatchController'),
  DispatchService: Symbol.for('DispatchService'),
  DispatchRepository: Symbol.for('DispatchRepository'),
};
```

> **Why symbols?** Symbols are unique identifiers used by Inversify (dependency injection library) to wire up dependencies. Each class needs a unique symbol.

### Step 8: Export Controller

Add the controller export in `src/controllers/index.ts`:

```typescript
// Purchase Order Controller
export * from './POController';

// Add new controller exports below:
export * from './DispatchController';  // ← Add this line
```

> **Why export here?** The build system scans this file to discover all controllers and their routes.

### Step 9: Create Lambda Configuration

Create the Lambda entry point in `src/lambdas/dispatch.lambda.ts`:

```typescript
/**
 * Dispatch Lambda Configuration
 * 
 * This file:
 * 1. Imports all required classes
 * 2. Registers them with the DI container
 * 3. Creates and exports the Lambda handler
 */

import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import controller (triggers decorator registration)
import { DispatchController } from '../controllers/DispatchController';

// Import services and repositories
import { DispatchService } from '../services/DispatchService';
import { DispatchRepository } from '../repositories/DispatchRepository';

// Define and register the lambda configuration
defineLambda({
  name: 'dispatch',                    // Lambda name (used in routing)
  controllers: [DispatchController],   // Controller classes for this lambda (array)
  bindings: [
    // Register service with its symbol
    { symbol: TYPES.DispatchService, implementation: DispatchService },
    // Register repository with its symbol
    { symbol: TYPES.DispatchRepository, implementation: DispatchRepository },
  ],
  prismaSymbol: TYPES.PrismaClient,    // Symbol for database client
});

// Export the Lambda handler function
// This is what AWS Lambda will invoke
export const handler = createLambdaHandler('dispatch');
```

> **Note:** The `controllers` property is an array, allowing you to register multiple controllers per Lambda. For single-controller lambdas, use `controllers: [YourController]`.

### Step 10: Build and Test

```bash
# Build shared layer (only if you modified it)
npm run build:layer

# Build all Lambda functions
npm run build

# Generate API manifest (registers routes with API Gateway)
npm run build:manifest

# Or do all at once
npm run build:all
```

### Step 11: Deploy

```bash
# Navigate to CDK folder
cd ../cdk

# Deploy to development environment
npm run deploy:dev

# Or deploy to other environments
npm run deploy:qa
npm run deploy:prod
```

---

## Creating a Multi-Controller Lambda

When you have related functionality that should be grouped together (e.g., admin operations), you can create a single Lambda with multiple controllers. This reduces the number of Lambda functions while keeping code well-organized.

### When to Use Multi-Controller Lambdas

Use multi-controller lambdas when:
- Multiple functionalities are closely related (e.g., User, Role, Permission management)
- You want to reduce AWS Lambda count and costs
- The combined code size stays within Lambda limits (250MB)
- You want to share cold start costs across related endpoints

### Example: Admin Lambda Structure

```
api/src/
├── controllers/
│   └── admin/                      # Group admin controllers in subfolder
│       ├── index.ts                # Export all admin controllers
│       ├── UserController.ts
│       ├── RoleController.ts
│       └── PermissionController.ts
├── services/
│   └── admin/
│       ├── UserService.ts
│       ├── RoleService.ts
│       └── PermissionService.ts
├── repositories/
│   └── admin/
│       ├── UserRepository.ts
│       ├── RoleRepository.ts
│       └── PermissionRepository.ts
└── lambdas/
    └── admin.lambda.ts
```

### Step-by-Step: Creating an Admin Lambda

#### 1. Create Controllers with Same `lambdaName`

Each controller must use the same `lambdaName` in the `@Controller` decorator:

```typescript
// src/controllers/admin/UserController.ts
@Controller({ path: '/api/admin/users', lambdaName: 'admin' })
@injectable()
export class UserController {
  constructor(@inject(TYPES.UserService) private userService: IUserService) {}

  @Get('/')
  async getAll(): Promise<APIGatewayProxyResult> { ... }

  @Post('/')
  async create(@Body() data: CreateUserRequest): Promise<APIGatewayProxyResult> { ... }
}
```

```typescript
// src/controllers/admin/RoleController.ts
@Controller({ path: '/api/admin/roles', lambdaName: 'admin' })
@injectable()
export class RoleController {
  constructor(@inject(TYPES.RoleService) private roleService: IRoleService) {}

  @Get('/')
  async getAll(): Promise<APIGatewayProxyResult> { ... }

  @Post('/')
  async create(@Body() data: CreateRoleRequest): Promise<APIGatewayProxyResult> { ... }
}
```

```typescript
// src/controllers/admin/PermissionController.ts
@Controller({ path: '/api/admin/permissions', lambdaName: 'admin' })
@injectable()
export class PermissionController {
  constructor(@inject(TYPES.PermissionService) private permissionService: IPermissionService) {}

  @Get('/')
  async getAll(): Promise<APIGatewayProxyResult> { ... }

  @Post('/')
  async create(@Body() data: CreatePermissionRequest): Promise<APIGatewayProxyResult> { ... }
}
```

#### 2. Export Controllers from Index File

```typescript
// src/controllers/admin/index.ts
export * from './UserController';
export * from './RoleController';
export * from './PermissionController';
```

```typescript
// src/controllers/index.ts
export * from './POController';
export * from './admin';  // ← Export all admin controllers
```

#### 3. Register All Types

```typescript
// src/types/types.ts
export const TYPES = {
  // ... existing types ...

  // Admin - Users
  UserController: Symbol.for('UserController'),
  UserService: Symbol.for('UserService'),
  UserRepository: Symbol.for('UserRepository'),

  // Admin - Roles
  RoleController: Symbol.for('RoleController'),
  RoleService: Symbol.for('RoleService'),
  RoleRepository: Symbol.for('RoleRepository'),

  // Admin - Permissions
  PermissionController: Symbol.for('PermissionController'),
  PermissionService: Symbol.for('PermissionService'),
  PermissionRepository: Symbol.for('PermissionRepository'),
};
```

#### 4. Create Lambda Configuration

```typescript
// src/lambdas/admin.lambda.ts
import 'reflect-metadata';
import { defineLambda, createLambdaHandler } from '@arcforge/shared';
import { TYPES } from '../types/types';

// Import all controllers
import { UserController } from '../controllers/admin/UserController';
import { RoleController } from '../controllers/admin/RoleController';
import { PermissionController } from '../controllers/admin/PermissionController';

// Import all services
import { UserService } from '../services/admin/UserService';
import { RoleService } from '../services/admin/RoleService';
import { PermissionService } from '../services/admin/PermissionService';

// Import all repositories
import { UserRepository } from '../repositories/admin/UserRepository';
import { RoleRepository } from '../repositories/admin/RoleRepository';
import { PermissionRepository } from '../repositories/admin/PermissionRepository';

defineLambda({
  name: 'admin',
  controllers: [
    UserController,
    RoleController,
    PermissionController,
  ],
  bindings: [
    // User bindings
    { symbol: TYPES.UserService, implementation: UserService },
    { symbol: TYPES.UserRepository, implementation: UserRepository },
    // Role bindings
    { symbol: TYPES.RoleService, implementation: RoleService },
    { symbol: TYPES.RoleRepository, implementation: RoleRepository },
    // Permission bindings
    { symbol: TYPES.PermissionService, implementation: PermissionService },
    { symbol: TYPES.PermissionRepository, implementation: PermissionRepository },
  ],
  prismaSymbol: TYPES.PrismaClient,
});

export const handler = createLambdaHandler('admin');
```

#### 5. Generated Manifest

When you run `npm run build:manifest`, the manifest will show all routes grouped under the `admin` lambda:

```json
{
  "lambdas": {
    "admin": {
      "handler": "dist/handlers/admin.handler",
      "controller": "UserController, RoleController, PermissionController",
      "routes": [
        { "method": "GET", "path": "/api/admin/users", "controller": "UserController", "action": "getAll" },
        { "method": "POST", "path": "/api/admin/users", "controller": "UserController", "action": "create" },
        { "method": "GET", "path": "/api/admin/roles", "controller": "RoleController", "action": "getAll" },
        { "method": "POST", "path": "/api/admin/roles", "controller": "RoleController", "action": "create" },
        { "method": "GET", "path": "/api/admin/permissions", "controller": "PermissionController", "action": "getAll" },
        { "method": "POST", "path": "/api/admin/permissions", "controller": "PermissionController", "action": "create" }
      ]
    }
  }
}
```

### Key Points for Multi-Controller Lambdas

1. **Same `lambdaName`**: All controllers in the same Lambda must use the same `lambdaName` in their `@Controller` decorator
2. **Different `path`**: Each controller should have a unique base path to avoid route conflicts
3. **All bindings**: Register ALL services and repositories from all controllers in the `bindings` array
4. **Import all controllers**: Import and list all controller classes in the `controllers` array
5. **Organize in subfolders**: Group related controllers, services, and repositories in subfolders for better organization

---

## File Structure Summary

### Single-Controller Lambda Structure

```
api/
├── src/
│   ├── controllers/
│   │   ├── index.ts                    # ← Export all controllers
│   │   ├── POController.ts
│   │   └── DispatchController.ts       # ← NEW
│   │
│   ├── services/
│   │   ├── POService.ts
│   │   └── DispatchService.ts          # ← NEW
│   │
│   ├── repositories/
│   │   ├── PORepository.ts
│   │   └── DispatchRepository.ts       # ← NEW
│   │
│   ├── schemas/
│   │   ├── index.ts                    # ← Export new schemas
│   │   ├── request/
│   │   │   ├── PORequest.ts
│   │   │   └── DispatchRequest.ts      # ← NEW
│   │   └── response/
│   │       ├── POResponse.ts
│   │       └── DispatchResponse.ts     # ← NEW
│   │
│   ├── types/
│   │   └── types.ts                    # ← Add new TYPES symbols
│   │
│   └── lambdas/
│       ├── po.lambda.ts
│       └── dispatch.lambda.ts          # ← NEW
│
├── layers/
│   └── shared/
│       └── nodejs/
│           └── prisma/
│               └── schema.prisma       # ← Add new model
│
└── app-manifest.json                   # ← Auto-generated
```

### Multi-Controller Lambda Structure (e.g., Admin)

```
api/
├── src/
│   ├── controllers/
│   │   ├── index.ts                    # ← Export all controllers including admin/
│   │   ├── POController.ts
│   │   └── admin/                      # ← Group related controllers
│   │       ├── index.ts                # ← Export admin controllers
│   │       ├── UserController.ts
│   │       ├── RoleController.ts
│   │       └── PermissionController.ts
│   │
│   ├── services/
│   │   ├── POService.ts
│   │   └── admin/                      # ← Group related services
│   │       ├── UserService.ts
│   │       ├── RoleService.ts
│   │       └── PermissionService.ts
│   │
│   ├── repositories/
│   │   ├── PORepository.ts
│   │   └── admin/                      # ← Group related repositories
│   │       ├── UserRepository.ts
│   │       ├── RoleRepository.ts
│   │       └── PermissionRepository.ts
│   │
│   ├── schemas/
│   │   ├── index.ts
│   │   ├── request/
│   │   │   └── admin/                  # ← Group related schemas
│   │   │       ├── UserRequest.ts
│   │   │       ├── RoleRequest.ts
│   │   │       └── PermissionRequest.ts
│   │   └── response/
│   │       └── admin/
│   │           ├── UserResponse.ts
│   │           ├── RoleResponse.ts
│   │           └── PermissionResponse.ts
│   │
│   ├── types/
│   │   └── types.ts                    # ← Add symbols for all controllers/services/repos
│   │
│   └── lambdas/
│       ├── po.lambda.ts
│       └── admin.lambda.ts             # ← Single lambda file with multiple controllers
│
└── app-manifest.json                   # ← Routes for all admin controllers
```

---

## Quick Checklist

Use this checklist when creating a new Lambda:

### Single-Controller Lambda

#### Files to Create
- [ ] `src/schemas/request/<Name>Request.ts` - Request interfaces
- [ ] `src/schemas/response/<Name>Response.ts` - Response interfaces
- [ ] `src/repositories/<Name>Repository.ts` - Database operations
- [ ] `src/services/<Name>Service.ts` - Business logic
- [ ] `src/controllers/<Name>Controller.ts` - API endpoints
- [ ] `src/lambdas/<name>.lambda.ts` - Lambda configuration

#### Files to Update
- [ ] `src/schemas/index.ts` - Export new schemas
- [ ] `src/types/types.ts` - Add new TYPES symbols
- [ ] `src/controllers/index.ts` - Export new controller
- [ ] `layers/shared/nodejs/prisma/schema.prisma` - Add new model (if needed)

### Multi-Controller Lambda (e.g., Admin)

#### Files to Create
- [ ] `src/controllers/<domain>/` - Create subfolder for related controllers
- [ ] `src/controllers/<domain>/<Name>Controller.ts` - Each controller
- [ ] `src/controllers/<domain>/index.ts` - Export all controllers
- [ ] `src/services/<domain>/<Name>Service.ts` - Each service
- [ ] `src/repositories/<domain>/<Name>Repository.ts` - Each repository
- [ ] `src/schemas/request/<domain>/<Name>Request.ts` - Request schemas
- [ ] `src/schemas/response/<domain>/<Name>Response.ts` - Response schemas
- [ ] `src/lambdas/<domain>.lambda.ts` - Single lambda file

#### Files to Update
- [ ] `src/schemas/index.ts` - Export all new schemas
- [ ] `src/types/types.ts` - Add TYPES for all controllers, services, repositories
- [ ] `src/controllers/index.ts` - Export the domain subfolder (`export * from './<domain>'`)

#### Key Points for Multi-Controller
- [ ] All controllers use the same `lambdaName` in `@Controller` decorator
- [ ] Each controller has a unique `path` to avoid route conflicts
- [ ] All bindings (services, repositories) are registered in the lambda file
- [ ] All controllers are listed in the `controllers` array

### Commands to Run

- [ ] `npm run db:migrate` - Create database migration (if new model)
- [ ] `npm run db:generate` - Regenerate Prisma client
- [ ] `npm run build:all` - Build everything
- [ ] `cd ../cdk && npm run deploy:dev` - Deploy to AWS

---

## Testing Your Lambda

### Using cURL

```bash
# Create a dispatch
curl -X POST http://localhost:3000/api/dispatch \
  -H "Content-Type: application/json" \
  -d '{"poId": "your-po-id", "dispatchDate": "2024-12-05", "carrier": "FedEx"}'

# List dispatches
curl http://localhost:3000/api/dispatch

# Get by ID
curl http://localhost:3000/api/dispatch/dispatch-id-here

# Update
curl -X PUT http://localhost:3000/api/dispatch/dispatch-id-here \
  -H "Content-Type: application/json" \
  -d '{"status": "shipped"}'

# Delete
curl -X DELETE http://localhost:3000/api/dispatch/dispatch-id-here
```

### Using VS Code REST Client

Create a file `api/test.http`:

```http
### Create Dispatch
POST http://localhost:3000/api/dispatch
Content-Type: application/json

{
  "poId": "your-po-id",
  "dispatchDate": "2024-12-05",
  "carrier": "FedEx"
}

### List Dispatches
GET http://localhost:3000/api/dispatch?page=1&limit=10

### Get Dispatch by ID
GET http://localhost:3000/api/dispatch/{{dispatchId}}

### Update Dispatch
PUT http://localhost:3000/api/dispatch/{{dispatchId}}
Content-Type: application/json

{
  "status": "shipped",
  "trackingNumber": "1234567890"
}

### Delete Dispatch
DELETE http://localhost:3000/api/dispatch/{{dispatchId}}
```

---

## Local Development

### Start Local API with SAM CLI

```bash
# From api folder
cd ../cdk

# Build and start local API
npm run local:start

# API will be available at http://localhost:3000
```

### View Database with Prisma Studio

```bash
# From api folder
npm run db:studio

# Opens browser at http://localhost:5555
```

### Watch Mode for Development

```bash
# Automatically rebuilds on file changes
npm run watch
```

---

## Available Decorators

### Controller Decorator

| Decorator | Description | Example |
|-----------|-------------|---------|
| `@Controller({ path, lambdaName })` | Marks class as controller | `@Controller({ path: '/api/dispatch', lambdaName: 'dispatch' })` |

### HTTP Method Decorators

| Decorator | Description | Example |
|-----------|-------------|---------|
| `@Get(path)` | HTTP GET | `@Get('/')` or `@Get('/{id}')` |
| `@Post(path)` | HTTP POST | `@Post('/')` |
| `@Put(path)` | HTTP PUT | `@Put('/{id}')` |
| `@Delete(path)` | HTTP DELETE | `@Delete('/{id}')` |
| `@Patch(path)` | HTTP PATCH | `@Patch('/{id}')` |

### Parameter Decorators

| Decorator | Description | Example |
|-----------|-------------|---------|
| `@Param('name')` | URL path parameter | `@Param('id') id: string` |
| `@Query('name')` | Query string parameter | `@Query('page') page: string` |
| `@Body()` | JSON request body | `@Body() data: CreateRequest` |
| `@Headers()` | All headers | `@Headers() headers: Record<string, string>` |
| `@Headers('name')` | Specific header | `@Headers('Authorization') auth: string` |
| `@Event()` | Raw Lambda event | `@Event() event: APIGatewayProxyEvent` |

---

## Common Patterns

### Pagination Response

```typescript
return createSuccessResponse(items, 200, {
  page: 1,
  limit: 10,
  total: 100,
  totalPages: 10,
});
```

### Error Handling

```typescript
// Not found (404)
throw new NotFoundError('Resource not found');

// Validation error (400)
throw new ValidationError('Invalid input');

// Custom error
throw new AppError('Something went wrong', 500);
```

### Optional Query Parameters

```typescript
@Get('/')
async list(
  @Query('page') page?: string,    // Optional with ?
  @Query('filter') filter?: string
) {
  const pageNum = page ? parseInt(page, 10) : 1;  // Default to 1
  // ...
}
```

### Date Handling

```typescript
// Prisma returns Date objects
// Convert to ISO string for response
const dateString = prismaDate.toISOString();

// For date-only fields
const dateOnly = prismaDate.toISOString().split('T')[0];  // "2024-12-05"

// Parsing string to Date for Prisma
const date = new Date(dateString);  // "2024-12-05" → Date object
```

---

## Troubleshooting

### "Lambda not appearing in manifest"

1. Check that `@Controller` decorator has `lambdaName` property
2. Ensure controller is exported from `src/controllers/index.ts`
3. Run `npm run build:manifest`

### "Cannot find module '@prisma/client'"

```bash
npm run db:generate
```

### "Cannot find module '@arcforge/shared'"

```bash
npm run build:layer
```

### "Symbol not found in container"

1. Check that symbol is added to `src/types/types.ts`
2. Check that binding is added to lambda config
3. Ensure class has `@injectable()` decorator

### "Column does not exist"

```bash
npm run db:migrate  # Apply migrations
npm run db:generate # Regenerate client
```

### "Connection refused to database"

1. Check database is running
2. Verify `.env` file has correct credentials
3. Check `IS_LOCAL=true` is set

---

## FAQ

### Q: Can I add multiple controllers to one Lambda?

Yes! You can group multiple related controllers into a single Lambda. This is useful for:
- **Reducing Lambda count**: Related functionality (e.g., admin operations) shares one Lambda
- **Sharing cold start costs**: Multiple endpoints benefit from the same warm Lambda
- **Code organization**: Keep related controllers, services, and repositories together

Example: An "admin" Lambda with User, Role, and Permission controllers:

```typescript
// src/lambdas/admin.lambda.ts
defineLambda({
  name: 'admin',
  controllers: [UserController, RoleController, PermissionController],
  bindings: [
    { symbol: TYPES.UserService, implementation: UserService },
    { symbol: TYPES.RoleService, implementation: RoleService },
    { symbol: TYPES.PermissionService, implementation: PermissionService },
    { symbol: TYPES.UserRepository, implementation: UserRepository },
    { symbol: TYPES.RoleRepository, implementation: RoleRepository },
    { symbol: TYPES.PermissionRepository, implementation: PermissionRepository },
  ],
  prismaSymbol: TYPES.PrismaClient,
});
```

Each controller uses the same `lambdaName` in its `@Controller` decorator:
```typescript
@Controller({ path: '/api/admin/users', lambdaName: 'admin' })
@Controller({ path: '/api/admin/roles', lambdaName: 'admin' })
@Controller({ path: '/api/admin/permissions', lambdaName: 'admin' })
```

See the [Multi-Controller Lambda Guide](#creating-a-multi-controller-lambda) section for detailed instructions.

### Q: Do I need a database table for every Lambda?

No, if your Lambda only reads from existing tables (e.g., a reporting Lambda), you don't need a new table.

### Q: How do I add authentication?

Add the `@Headers('Authorization')` decorator to extract the token, then validate it in your controller or a middleware.

### Q: Where do I put shared utilities?

Put them in `layers/shared/nodejs/src/utils/` and export from `index.ts`.

### Q: How do I call another Lambda?

Use AWS SDK's Lambda client, or call it via HTTP through API Gateway.

### Q: Can I use transactions across multiple tables?

Yes, use Prisma's `$transaction`:

```typescript
await this.prisma.$transaction([
  this.prisma.dispatch.create({ data: dispatch }),
  this.prisma.inventory.update({ where: { id }, data: stock }),
]);
```

---

## Next Steps

After creating your Lambda:

1. **Write Tests** - Add unit tests in `__tests__` folder
2. **Add Logging** - Use `logger` from shared layer for debugging
3. **Monitor** - Check CloudWatch logs after deployment
4. **Document** - Update API documentation if public-facing

---

*Last updated: 6 December 2025*
