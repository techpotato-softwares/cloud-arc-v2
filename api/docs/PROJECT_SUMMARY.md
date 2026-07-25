# Project Summary: ArcForge CloudArc Backend

This document summarizes the complete backend implementation for the ArcForge CloudArc system, including architecture decisions, technologies used, and setup instructions.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Decisions](#architecture-decisions)
4. [Project Structure](#project-structure)
5. [Custom Decorator System](#custom-decorator-system)
6. [Database Layer](#database-layer)
7. [Performance Optimizations](#performance-optimizations)
8. [Infrastructure (CDK)](#infrastructure-cdk)
9. [Code Quality Tools](#code-quality-tools)
10. [Development Workflow](#development-workflow)
11. [Key Implementation Details](#key-implementation-details)

---

## Project Overview

A serverless backend API for order tracking built on AWS Lambda with:

- **Decorator-based routing** similar to NestJS/Spring Boot
- **Manifest-driven API Gateway** routes auto-generated from decorators
- **Controller-Service-Repository (CSR)** pattern for clean architecture
- **Inversify** for dependency injection
- **Sequelize ORM** for PostgreSQL database operations
- **AWS CDK** for infrastructure as code
- **SAM CLI** for local development with hot reload

### What Was Built

| Component | Description |
|-----------|-------------|
| PO Lambda | Purchase Order CRUD operations |
| Shared Layer | Decorators, router, DB connection, utilities |
| CDK Infrastructure | API Gateway, Lambda, Secrets Manager integration |
| Manifest Generator | Scans decorators, generates route manifest |
| Code Quality | ESLint, Prettier, Husky pre-commit hooks |

---

## Technology Stack

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| TypeScript | ^5.3.2 | Type-safe JavaScript |
| Inversify | ^6.0.2 | Dependency injection container |
| Sequelize | ^6.35.2 | ORM for PostgreSQL |
| reflect-metadata | ^0.1.14 | Decorator metadata support |
| pg | ^8.11.3 | PostgreSQL driver |

### AWS Services

| Service | Purpose |
|---------|---------|
| Lambda | Serverless compute (Node.js 22.x, ARM64) |
| API Gateway | REST API endpoints |
| Secrets Manager | Database credentials storage |
| CloudWatch | Logging and monitoring |

### Development Tools

| Tool | Purpose |
|------|---------|
| esbuild | Fast TypeScript bundling (~50ms builds) |
| SAM CLI | Local Lambda development |
| ESLint | Code linting |
| Prettier | Code formatting |
| Husky | Git pre-commit hooks |
| ts-node | Run TypeScript directly |

---

## Architecture Decisions

### 1. Custom Decorators vs routing-controllers

**Decision: Custom decorators**

| Aspect | Custom Decorators | routing-controllers |
|--------|-------------------|---------------------|
| Bundle Size | ~50 lines | +Express +routing-controllers |
| Lambda Integration | Direct API Gateway | Requires serverless-express adapter |
| Cold Start | Faster | Slower (Express overhead) |
| Manifest Generation | Built-in | Would need custom solution |
| Extensibility | Full control | Limited to Express middleware |
| Learning Curve | Simple | Familiar if know Express |

**Rationale**: Custom decorators are lightweight, Lambda-native, and allow manifest generation for automatic API Gateway route creation.

### 2. Manifest-Driven Routing

**How it works:**

```
Build Time:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Controllers    │ ──► │  Build Script    │ ──► │ app-manifest.json│
│  @Get, @Post    │     │  (scan metadata) │     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘

CDK Synth:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ app-manifest.json│ ──► │  CDK Stack       │ ──► │ API Gateway     │
│                 │     │  (read manifest) │     │ Routes          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

**Benefits:**
- Routes defined in code, infrastructure auto-generated
- Single source of truth (decorators)
- No manual API Gateway configuration
- Easy to add new routes

### 3. Shared Lambda Layer

**Decision: Move decorators and core router to shared layer**

**Contents of shared layer:**
- `decorators/` - @Controller, @Get, @Post, @Param, etc.
- `core/` - Router, parameter resolver
- `database/` - Sequelize connection with pooling
- `middleware/` - Error handling, CORS
- `utils/` - Logger, secrets manager client
- `config/` - Environment configuration

**Benefits:**
- Reused across all Lambda functions
- Reduced bundle size per Lambda
- Faster deployments (layer cached)
- Consistent behavior across functions

### 4. Controller-Service-Repository Pattern

```
Request Flow:
API Gateway → Handler → Router → Controller → Service → Repository → DB
                                     ↓
Response Flow:                    Response
```

| Layer | Responsibility |
|-------|----------------|
| Controller | HTTP handling, validation, response formatting |
| Service | Business logic, transactions |
| Repository | Database operations only |

### 5. Database Connection Outside Handler

**Decision: Initialize DB connection during cold start, not per request**

```typescript
// Runs when Lambda container starts (OUTSIDE handler)
const coldStartInit = initialize().catch((error) => {
  logger.error('Failed to initialize during cold start', error);
});

export const handler = async (event, context) => {
  await initialize(); // Returns immediately if already done
  // ... handle request
};
```

**Benefits:**
- DB connection ready before first request
- Reduced latency for requests
- Connection reused across warm invocations

---

## Project Structure

```
api/
├── layers/
│   └── shared/nodejs/              # Shared Lambda Layer
│       └── src/
│           ├── config/             # Environment config
│           ├── core/               # Router, parameter resolver
│           ├── database/           # Sequelize connection
│           ├── decorators/         # Custom routing decorators
│           ├── middleware/         # Error handling, CORS
│           └── utils/              # Logger, secrets
├── src/
│   ├── container/                  # Inversify DI containers
│   ├── controllers/                # Route controllers
│   ├── handlers/                   # Lambda entry points
│   ├── models/                     # Sequelize models
│   ├── repositories/               # Database operations
│   ├── schemas/                    # Request/Response types
│   ├── services/                   # Business logic
│   └── types/                      # Inversify symbols
├── scripts/
│   └── generate-manifest.ts        # Route manifest generator
├── migrations/                     # Database migrations
├── docs/                           # Documentation
├── app-manifest.json               # Generated route manifest
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── .eslintrc.json
└── .prettierrc

cdk/
├── bin/cdk.ts                      # CDK app entry
├── lib/
│   ├── config/environment.ts       # Dev/QA/Prod configs
│   ├── constructs/
│   │   ├── lambda-construct.ts     # Lambda from manifest
│   │   └── api-gateway-construct.ts # Routes from manifest
│   ├── stacks/api-stack.ts         # Main stack
│   └── utils/manifest-reader.ts    # Reads app-manifest.json
├── events/                         # Test event payloads
├── env.json                        # Local environment variables
└── package.json
```

---

## Custom Decorator System

### Available Decorators

#### Class Decorators

```typescript
@Controller('/api/po')                          // Basic
@Controller({ path: '/api/po', lambdaName: 'po' }) // With options
```

#### Method Decorators

| Decorator | HTTP Method | Example |
|-----------|-------------|---------|
| `@Get(path)` | GET | `@Get('/')`, `@Get('/{id}')` |
| `@Post(path)` | POST | `@Post('/')` |
| `@Put(path)` | PUT | `@Put('/{id}')` |
| `@Delete(path)` | DELETE | `@Delete('/{id}')` |
| `@Patch(path)` | PATCH | `@Patch('/{id}')` |

#### Parameter Decorators

| Decorator | Source | Example |
|-----------|--------|---------|
| `@Param('name')` | Path parameter | `@Param('id') id: string` |
| `@Query('name')` | Query string | `@Query('page') page: number` |
| `@Body()` | Request body | `@Body() data: CreateRequest` |
| `@Event()` | Raw API Gateway event | `@Event() event: APIGatewayProxyEvent` |
| `@Headers()` | All headers | `@Headers() headers: Record<string, string>` |
| `@Headers('name')` | Specific header | `@Headers('authorization') auth: string` |

### Example Controller

```typescript
@Controller({ path: '/api/po', lambdaName: 'po' })
@injectable()
export class POController {
  constructor(@inject(TYPES.POService) private poService: IPOService) {}

  @Post('/')
  async create(@Body() data: CreatePORequest): Promise<APIGatewayProxyResult> {
    const po = await this.poService.createPO(data);
    return createSuccessResponse(po, 201);
  }

  @Get('/')
  async getAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<APIGatewayProxyResult> {
    // ...
  }

  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    // ...
  }

  @Put('/{id}')
  async update(
    @Param('id') id: string,
    @Body() data: UpdatePORequest
  ): Promise<APIGatewayProxyResult> {
    // ...
  }

  @Delete('/{id}')
  async delete(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    // ...
  }
}
```

### How Decorators Work

1. **Decorator Registration**: When TypeScript compiles, decorators store metadata using `reflect-metadata`

2. **Route Registry**: `routeRegistry` singleton collects all controller and route metadata

3. **Manifest Generation**: `generate-manifest.ts` script reads registry, outputs `app-manifest.json`

4. **CDK Integration**: CDK reads manifest, creates API Gateway routes

5. **Runtime Routing**: Handler creates Router, which matches requests to controller methods

---

## Database Layer

### Connection Configuration

```typescript
pool: {
  max: 2,        // Lambda gets 2 connections max
  min: 0,        // Allow pool to shrink to 0
  acquire: 10000, // 10s connection timeout
  idle: 5000,    // 5s idle before close
}
```

### Secrets Caching

- Local development: Environment variables from `env.json`
- AWS: Secrets Manager with 5-minute cache

```typescript
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const getDatabaseConfig = async (): Promise<DatabaseConfig> => {
  if (cachedDbConfig && cacheExpiry > Date.now()) {
    return cachedDbConfig; // Return cached
  }
  // Fetch from Secrets Manager...
};
```

### Models

| Model | Table | Description |
|-------|-------|-------------|
| PurchaseOrder | purchase_orders | Main PO entity |
| POItem | po_items | Line items (1:N with PO) |

### Migrations

```bash
npm run migrate           # Run all migrations
npm run migrate:undo      # Undo last migration
npm run migrate:undo:all  # Undo all migrations
```

---

## Performance Optimizations

### 1. Cold Start Optimization

| Optimization | Implementation |
|--------------|----------------|
| DB connection outside handler | `initialize()` called at module level |
| Singleton DI container | Cached and reused across invocations |
| Secrets caching | 5-minute cache for DB credentials |
| ARM64 architecture | 20% better price-performance |

### 2. Build Optimization

| Tool | Benefit |
|------|---------|
| esbuild | ~100x faster than tsc (~50ms vs 5s) |
| Tree shaking | Removes unused code |
| External AWS SDK | Uses Lambda runtime's SDK |

### 3. Runtime Optimization

| Optimization | Implementation |
|--------------|----------------|
| Connection pooling | Max 2 connections per Lambda |
| TCP keep-alive | Connections reused |
| `callbackWaitsForEmptyEventLoop = false` | Prevents hanging |
| Singleton services | Reused across requests |

---

## Infrastructure (CDK)

### Environment Configuration

| Environment | Memory | Timeout | Database | Secrets Path |
|-------------|--------|---------|----------|--------------|
| dev | 256 MB | 30s | Supabase | /arcforge/dev/db |
| qa | 512 MB | 30s | RDS | /arcforge/qa/db |
| prod | 1024 MB | 30s | RDS | /arcforge/prod/db |

### Stack Components

1. **Shared Lambda Layer** - Decorators, router, DB, utilities
2. **Lambda Functions** - Created from manifest
3. **API Gateway** - Routes from manifest
4. **IAM Roles** - Secrets Manager, CloudWatch access

### Deployment Commands

```bash
cd cdk

# First time
npm run bootstrap

# Deploy
npm run deploy:dev
npm run deploy:qa
npm run deploy:prod
```

---

## Code Quality Tools

### ESLint Configuration

```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ]
}
```

### Prettier Configuration

```json
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

### Husky Pre-commit Hooks

Runs on every commit:
1. ESLint checks and fixes staged `.ts` files
2. Prettier formats staged files
3. Commit fails if errors can't be fixed

### Commands

```bash
npm run lint          # Check for errors
npm run lint:fix      # Fix errors
npm run format        # Format code
npm run format:check  # Check formatting
```

---

## Development Workflow

### Initial Setup

```bash
# Root (Husky)
npm install

# API
cd api && npm install

# CDK
cd ../cdk && npm install

# Build everything
cd ../api && npm run build:all
```

### Local Development

**Terminal 1 - Watch Mode:**
```bash
cd api && npm run watch
```

**Terminal 2 - Local API:**
```bash
cd cdk && npm run dev
```

### Adding New Routes

1. Add decorator to controller:
```typescript
@Get('/search')
async search(@Query('q') q: string) { }
```

2. Regenerate manifest:
```bash
npm run build:manifest
```

3. Re-synth CDK:
```bash
cd ../cdk && npm run synth:dev
```

### Adding New Controllers

1. Create controller with `@Controller` decorator
2. Add import to `scripts/generate-manifest.ts`
3. Create handler and DI container
4. Run `npm run build:all`

---

## Key Implementation Details

### Handler Structure

```typescript
// Cold start initialization (OUTSIDE handler)
const coldStartInit = initialize().catch(console.error);

export const handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  // Fast path for CORS
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  
  await initialize(); // Instant if already done
  
  const response = await router.handleRequest(event, context);
  return response;
};
```

### DI Container Setup

```typescript
container.bind<Sequelize>(TYPES.Sequelize).toConstantValue(sequelize);
container.bind<IPORepository>(TYPES.PORepository).to(PORepository).inSingletonScope();
container.bind<IPOService>(TYPES.POService).to(POService).inSingletonScope();
container.bind<POController>(POController).toSelf().inSingletonScope();
```

### Router Flow

```
1. Handler receives API Gateway event
2. Router matches path pattern to registered route
3. Parameter resolver extracts @Param, @Query, @Body values
4. Controller method invoked with resolved parameters
5. Response returned (or wrapped in success response)
```

### Manifest Structure

```json
{
  "version": "1.0",
  "generatedAt": "2024-11-30T00:00:00.000Z",
  "lambdas": {
    "po": {
      "handler": "dist/handlers/po.handler.handler",
      "controller": "POController",
      "routes": [
        { "method": "POST", "path": "/api/po", "controller": "POController", "action": "create" },
        { "method": "GET", "path": "/api/po", "controller": "POController", "action": "getAll" },
        { "method": "GET", "path": "/api/po/{id}", "controller": "POController", "action": "getById" },
        { "method": "PUT", "path": "/api/po/{id}", "controller": "POController", "action": "update" },
        { "method": "DELETE", "path": "/api/po/{id}", "controller": "POController", "action": "delete" }
      ]
    }
  }
}
```

---

## Summary

This backend provides a production-ready serverless API with:

- ✅ Clean architecture (CSR pattern)
- ✅ Decorator-based routing
- ✅ Automatic API Gateway route generation
- ✅ Optimized Lambda performance
- ✅ Type-safe database operations
- ✅ Environment-specific deployments
- ✅ Local development with hot reload
- ✅ Code quality enforcement

The architecture is designed to be reusable across projects - simply copy the shared layer and CDK patterns.

---

*Generated from chat session on November 30, 2024*

