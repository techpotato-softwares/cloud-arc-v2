# Backend Architecture Documentation

A comprehensive guide to the serverless backend architecture using AWS Lambda, TypeScript, and decorator-based routing.

## Table of Contents

1. [Overview](#overview)
2. [Project Structure](#project-structure)
3. [Technology Stack](#technology-stack)
4. [Architecture Patterns](#architecture-patterns)
5. [Shared Lambda Layer](#shared-lambda-layer)
6. [Decorator System](#decorator-system)
7. [Database Layer](#database-layer)
8. [CDK Infrastructure](#cdk-infrastructure)
9. [Development Workflow](#development-workflow)
10. [Code Quality Tools](#code-quality-tools)
11. [Deployment](#deployment)
12. [Reusing This Infrastructure](#reusing-this-infrastructure)

---

## Overview

This backend is a serverless API built on AWS Lambda with the following key features:

- **Decorator-based routing** - Define routes using decorators like `@Get`, `@Post`
- **Controller-Service-Repository (CSR)** pattern - Clean separation of concerns
- **Inversify DI** - Dependency injection for loose coupling
- **Sequelize ORM** - Type-safe database operations
- **AWS CDK** - Infrastructure as Code
- **SAM CLI** - Local development with hot reload

### Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        API Gateway                                │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  /api/po/*  →  PO Lambda                                    │ │
│  │  /api/dispatch/*  →  Dispatch Lambda (future)               │ │
│  │  /api/delivery/*  →  Delivery Lambda (future)               │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Lambda Layer                               │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Decorators │ Router │ DB Connection │ Secrets │ Logger     │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Lambda Functions                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ PO Lambda    │  │ Dispatch     │  │ Delivery     │           │
│  │ ┌──────────┐ │  │ Lambda       │  │ Lambda       │           │
│  │ │Controller│ │  │ (future)     │  │ (future)     │           │
│  │ │ Service  │ │  │              │  │              │           │
│  │ │Repository│ │  │              │  │              │           │
│  │ └──────────┘ │  │              │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                        Database                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Local: Supabase PostgreSQL                                 │ │
│  │  Dev/QA/Prod: AWS RDS PostgreSQL                            │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
api/
├── layers/
│   └── shared/nodejs/              # Shared Lambda Layer
│       ├── src/
│       │   ├── config/             # Environment configuration
│       │   ├── database/           # Sequelize connection
│       │   ├── decorators/         # Custom routing decorators
│       │   │   ├── metadata.ts     # Metadata keys & types
│       │   │   ├── registry.ts     # Route registry
│       │   │   ├── controller.decorator.ts
│       │   │   ├── http.decorator.ts
│       │   │   └── param.decorator.ts
│       │   ├── core/               # Router engine
│       │   │   ├── router.ts       # Request dispatcher
│       │   │   └── parameter-resolver.ts
│       │   ├── middleware/         # Error handling, CORS
│       │   └── utils/              # Logger, secrets
│       ├── package.json
│       └── tsconfig.json
├── src/
│   ├── controllers/                # Route controllers
│   ├── services/                   # Business logic
│   ├── repositories/               # Database operations
│   ├── models/                     # Sequelize models
│   ├── schemas/                    # Request/Response types
│   ├── handlers/                   # Lambda entry points
│   ├── container/                  # DI container setup
│   └── types/                      # Inversify symbols
├── scripts/
│   └── generate-manifest.ts        # Route manifest generator
├── migrations/                     # Database migrations
├── config/                         # Sequelize CLI config
├── app-manifest.json               # Generated route manifest
├── package.json
├── tsconfig.json
├── esbuild.config.js
├── .eslintrc.json
└── .prettierrc
```

---

## Technology Stack

### Core Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.3.2 | Type-safe JavaScript |
| `inversify` | ^6.0.2 | Dependency injection |
| `sequelize` | ^6.35.2 | ORM for PostgreSQL |
| `reflect-metadata` | ^0.1.14 | Decorator metadata |
| `pg` | ^8.11.3 | PostgreSQL driver |

### AWS Dependencies

| Package | Purpose |
|---------|---------|
| `@aws-sdk/client-secrets-manager` | Fetch DB credentials |
| `aws-cdk-lib` | Infrastructure as Code |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `esbuild` | Fast TypeScript bundling |
| `ts-node` | Run TypeScript directly |
| `eslint` | Code linting |
| `prettier` | Code formatting |
| `husky` | Git hooks |
| `lint-staged` | Staged file linting |
| `jest` | Testing framework |

---

## Architecture Patterns

### Controller-Service-Repository (CSR)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Request Flow                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request → Router → Controller → Service → Repository → DB      │
│                                                                  │
│  Response ← Router ← Controller ← Service ← Repository ← DB     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Controller
- Handles HTTP requests
- Validates input using decorators
- Calls service methods
- Returns formatted responses

```typescript
@Controller('/api/po')
export class POController {
  constructor(@inject(TYPES.POService) private poService: IPOService) {}

  @Get('/{id}')
  async getById(@Param('id') id: string): Promise<APIGatewayProxyResult> {
    const po = await this.poService.getPOById(id);
    return createSuccessResponse(po);
  }
}
```

#### Service
- Contains business logic
- Manages transactions
- Orchestrates repository calls

```typescript
@injectable()
export class POService implements IPOService {
  constructor(@inject(TYPES.PORepository) private poRepository: IPORepository) {}

  async createPO(data: CreatePORequest): Promise<POResponse> {
    const transaction = await this.sequelize.transaction();
    try {
      const po = await this.poRepository.create(data, transaction);
      await transaction.commit();
      return this.mapToResponse(po);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
```

#### Repository
- Database operations only
- Uses Sequelize models
- Handles query building

```typescript
@injectable()
export class PORepository implements IPORepository {
  async findById(id: string): Promise<PurchaseOrder | null> {
    return PurchaseOrder.findByPk(id, {
      include: [{ model: POItem, as: 'poItems' }],
    });
  }
}
```

### Dependency Injection with Inversify

```typescript
// types/types.ts
export const TYPES = {
  POController: Symbol.for('POController'),
  POService: Symbol.for('POService'),
  PORepository: Symbol.for('PORepository'),
  Sequelize: Symbol.for('Sequelize'),
};

// container/po.container.ts
container.bind<IPOService>(TYPES.POService).to(POService).inSingletonScope();
container.bind<IPORepository>(TYPES.PORepository).to(PORepository).inSingletonScope();
```

---

## Shared Lambda Layer

The shared layer (`layers/shared/nodejs/`) contains reusable code across all Lambda functions:

### Layer Contents

| Module | Exports | Purpose |
|--------|---------|---------|
| `decorators/` | `@Controller`, `@Get`, `@Post`, `@Param`, etc. | Route definition |
| `core/` | `Router`, `createRouter`, `parameterResolver` | Request dispatching |
| `database/` | `getSequelize`, `closeConnection` | DB connection pooling |
| `middleware/` | `createSuccessResponse`, `createErrorResponse` | Response formatting |
| `utils/` | `logger`, `getDatabaseConfig` | Utilities |
| `config/` | `getAppConfig` | Environment config |

### Using Layer Exports

```typescript
// In Lambda code, import from layer path
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  createRouter,
  logger,
  createSuccessResponse,
} from '/opt/nodejs/dist';
```

### Layer Benefits

1. **Reduced bundle size** - Common code not duplicated in each Lambda
2. **Faster deployments** - Layer updated separately
3. **Consistent behavior** - Same code across all functions
4. **Cold start optimization** - Layer cached in Lambda environment

---

## Decorator System

### Available Decorators

#### Class Decorators

```typescript
// Basic controller
@Controller('/api/po')
export class POController { }

// With options
@Controller({ path: '/api/po', lambdaName: 'po' })
export class POController { }
```

#### Method Decorators

| Decorator | HTTP Method | Example |
|-----------|-------------|---------|
| `@Get(path)` | GET | `@Get('/')` |
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
| `@Event()` | Raw event | `@Event() event: APIGatewayProxyEvent` |
| `@Headers()` | All headers | `@Headers() headers: Record<string, string>` |
| `@Headers('name')` | Specific header | `@Headers('authorization') auth: string` |

### How Decorators Work

1. **Build time**: Decorators store metadata using `reflect-metadata`
2. **Manifest generation**: Script scans metadata, creates `app-manifest.json`
3. **CDK synth**: Reads manifest, creates API Gateway routes
4. **Runtime**: Router matches requests, invokes controller methods

---

## Database Layer

### Connection Management

```typescript
// Optimized for Lambda - singleton with health checks
export const getSequelize = async (): Promise<Sequelize> => {
  if (sequelizeInstance) {
    await sequelizeInstance.authenticate(); // Health check
    return sequelizeInstance;
  }
  // Create new connection...
};
```

### Pool Configuration

```typescript
pool: {
  max: 2,        // Lambda gets 2 connections max
  min: 0,        // Allow pool to shrink
  acquire: 10000, // 10s connection timeout
  idle: 5000,    // 5s idle before close
}
```

### Secrets Management

- Local: Environment variables from `env.json`
- AWS: Secrets Manager with 5-minute cache

```typescript
const getDatabaseConfig = async (): Promise<DatabaseConfig> => {
  if (cachedDbConfig && cacheExpiry > Date.now()) {
    return cachedDbConfig;
  }
  // Fetch from Secrets Manager...
};
```

### Migrations

```bash
# Run migrations
pnpm migrate

# Rollback last migration
pnpm migrate:undo

# Rollback all migrations
pnpm migrate:undo:all
```

---

## CDK Infrastructure

### Stack Structure

```
infra/cdk/
├── bin/cdk.ts                    # Entry point
├── lib/
│   ├── config/environment.ts     # Dev/QA/Prod configs
│   ├── constructs/
│   │   ├── lambda-construct.ts   # Lambda from manifest
│   │   └── api-gateway-construct.ts  # Routes from manifest
│   ├── stacks/api-stack.ts       # Main stack
│   └── utils/manifest-reader.ts  # Reads app-manifest.json
```

### Environment Configuration

| Environment | Memory | Timeout | Database |
|-------------|--------|---------|----------|
| dev | 256 MB | 30s | Supabase |
| qa | 512 MB | 30s | RDS |
| prod | 1024 MB | 30s | RDS |

### Manifest-Driven Routes

CDK reads `app-manifest.json` to create API Gateway routes automatically:

```json
{
  "lambdas": {
    "po": {
      "handler": "dist/handlers/po.handler.handler",
      "routes": [
        { "method": "POST", "path": "/api/po" },
        { "method": "GET", "path": "/api/po/{id}" }
      ]
    }
  }
}
```

---

## Development Workflow

### Prerequisites

Before starting, ensure you have the following installed:

| Tool | Version | Purpose | Download |
|------|---------|---------|----------|
| **Node.js** | 22.x+ | JavaScript runtime | [nodejs.org](https://nodejs.org/) |
| **AWS CLI** | v2 | AWS commands & SAM dependency | [AWS CLI Install](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| **AWS SAM CLI** | Latest | Local Lambda development | [SAM CLI Install](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) |
| **Docker** | Latest | Required by SAM CLI | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |
| **PostgreSQL** | 14+ | Database (or use Supabase) | [postgresql.org](https://www.postgresql.org/download/) |

#### Verify Installation

```bash
# Check Node.js
node --version     # Should be v22.x or later

# Check AWS CLI
aws --version      # Should be aws-cli/2.x.x

# Check SAM CLI
sam --version      # Should be SAM CLI, version 1.x.x

# Check Docker
docker --version   # Should be Docker version 2x.x.x

# Configure AWS CLI (if not already done)
aws configure      # Enter your AWS Access Key, Secret Key, Region
```

### Initial Setup

```bash
# Install root dependencies (husky)
pnpm install

# Install API dependencies
cd apps/api && pnpm install

# Install CDK dependencies
cd ../cdk && pnpm install

# Build everything
cd ../api && pnpm build:all
```

### Local Development

**Terminal 1 - Watch Mode**
```bash
cd apps/api
pnpm watch
```

**Terminal 2 - Local API**
```bash
cd infra/cdk
pnpm dev
```

### Adding New Routes

1. Add decorator to controller:
```typescript
@Get('/search')
async search(@Query('q') q: string) { }
```

2. Regenerate manifest:
```bash
pnpm build:manifest
```

3. Re-synth CDK:
```bash
cd ../cdk && pnpm synth:dev
```

### Adding New Controllers

1. Create controller with decorators
2. Add import to `scripts/generate-manifest.ts`
3. Create handler and container
4. Run `pnpm build:all`

---

## Code Quality Tools

### ESLint

Linting with TypeScript and Prettier integration:

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:prettier/recommended"
  ]
}
```

```bash
# Check for errors
pnpm lint

# Fix errors
pnpm lint:fix
```

### Prettier

Consistent code formatting:

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

```bash
# Format code
pnpm format

# Check formatting
pnpm format:check
```

### Husky + lint-staged

Pre-commit hooks to ensure code quality:

```bash
# .husky/pre-commit runs:
npx lint-staged

# lint-staged config in package.json:
"lint-staged": {
  "api/**/*.ts": ["eslint --fix", "prettier --write"]
}
```

### Setup Husky

```bash
# At project root
pnpm install
npx husky install
```

---

## Deployment

### Deploy to AWS

```bash
cd infra/cdk

# First time - bootstrap CDK
pnpm bootstrap

# Deploy to environment
pnpm deploy:dev
pnpm deploy:qa
pnpm deploy:prod
```

### CI/CD (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: cd apps/api && pnpm build:all
      - run: cd infra/cdk && pnpm deploy:${{ env.STAGE }}
```

---

## Reusing This Infrastructure

### For a New Project

1. **Copy the structure**:
   - `packages/shared/` - Shared layer with decorators
   - `infra/cdk/` - CDK infrastructure
   - Root `package.json` with Husky config

2. **Update naming**:
   - Change `@forgearc` to your project name
   - Update stack names in `infra/cdk/lib/config/environment.ts`

3. **Create your controllers**:
```typescript
@Controller('/api/your-entity')
export class YourController {
  @Get('/')
  async getAll() { }
}
```

4. **Update manifest generator**:
```typescript
// scripts/generate-manifest.ts
import '../src/controllers/YourController';
```

5. **Create models and migrations** for your entities

6. **Deploy**:
```bash
pnpm build:all
cd infra/cdk && pnpm deploy:dev
```

### Checklist for New Projects

- [ ] Copy `packages/shared/`
- [ ] Copy `infra/cdk/` folder
- [ ] Copy root `package.json` and `.husky/`
- [ ] Update project/stack names
- [ ] Create your models and migrations
- [ ] Create controllers with decorators
- [ ] Create services and repositories
- [ ] Update `generate-manifest.ts`
- [ ] Configure `env.json` for local development
- [ ] Set up Secrets Manager for each environment
- [ ] Deploy with CDK

---

## Quick Reference

### Commands

| Command | Location | Purpose |
|---------|----------|---------|
| `pnpm build:all` | api/ | Build everything |
| `pnpm build:manifest` | api/ | Generate route manifest |
| `pnpm watch` | api/ | Watch mode (hot reload) |
| `pnpm lint` | api/ | Run ESLint |
| `pnpm format` | api/ | Format with Prettier |
| `pnpm migrate` | api/ | Run DB migrations |
| `pnpm dev` | infra/cdk/ | Start local API |
| `pnpm deploy:dev` | infra/cdk/ | Deploy to dev |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ENVIRONMENT` | dev/qa/prod |
| `DB_SECRET_ID` | Secrets Manager secret ID |
| `LOG_LEVEL` | DEBUG/INFO/WARN/ERROR |
| `IS_LOCAL` | true for local development |
| `DB_HOST` | Database host (local) |
| `DB_PORT` | Database port (local) |
| `DB_NAME` | Database name (local) |
| `DB_USERNAME` | Database user (local) |
| `DB_PASSWORD` | Database password (local) |

---

## License

MIT

