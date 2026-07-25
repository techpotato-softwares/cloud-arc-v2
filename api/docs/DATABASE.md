# Database Management with Prisma

This document describes the database setup and management using Prisma ORM.

## Overview

The ArcForge CloudArc API uses **Prisma** as its ORM (Object-Relational Mapping) tool. Prisma provides:

- **Type-safe database queries** - All queries are type-checked at compile time
- **Auto-generated types** - No manual model files needed
- **Migration management** - Version-controlled database schema changes
- **Single source of truth** - Schema defined in one place (`schema.prisma`)

---

## Project Structure

```
api/
├── layers/
│   └── shared/
│       └── nodejs/
│           ├── prisma/
│           │   ├── schema.prisma      # Database schema definition
│           │   └── migrations/        # Auto-generated migration files
│           ├── .env                   # Local database credentials
│           ├── .env.example           # Template for .env
│           └── node_modules/
│               └── .prisma/
│                   └── client/        # Generated Prisma Client
├── scripts/
│   └── db-migrate-prod.js             # Production migration script
└── package.json                       # Contains db: scripts
```

---

## Prerequisites

1. Copy `.env.example` to `.env` in `api/layers/shared/nodejs/`
2. Fill in your database credentials (see Environment Variables below)

---

## Environment Variables

Prisma requires database connection details. Configuration differs between local development and AWS.

### Local Development

Create `.env` file in `api/layers/shared/nodejs/`:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/arcforge?schema=public"

# Or use individual variables:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=arcforge
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_SSL=false
IS_LOCAL=true
```

### AWS (Lambda)

For production deployments:
- Credentials are fetched from **AWS Secrets Manager**
- Set `DB_SECRET_ID` environment variable to the secret ARN/name
- Set `DB_SSL=true` for secure connections

### AWS RDS (Production)

Production uses AWS RDS PostgreSQL, automatically provisioned via CDK:

```bash
# RDS is created when deploying with features.rds: true
cd cdk
npm run deploy:prod
```

**RDS Configuration** (`cdk/config/rds.config.ts`):
- Instance: `db.t4g.micro` (~$12/month) - configurable
- Storage: 20GB gp3, auto-scales to 100GB
- Backups: 7 days retention
- Deletion Protection: Enabled

**Retrieve RDS credentials:**
```bash
aws secretsmanager get-secret-value --secret-id /arcforge/prod/db --query SecretString --output text
```

**Connect to RDS:**
```bash
# Get endpoint from CDK outputs or AWS Console
psql "host=arcforge-db-prod.xxx.rds.amazonaws.com port=5432 dbname=arcforge user=oriana_admin sslmode=require"
```

---

## Commands Reference

Run all commands from the `api/` directory.

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate/regenerate Prisma Client after schema changes |
| `npm run db:migrate` | Create and apply a new migration (development) |
| `npm run db:migrate:prod` | Apply pending migrations to production (fetches creds from Secrets Manager) |
| `npm run db:push` | Push schema changes directly without creating migration files (dev only) |
| `npm run db:studio` | Open Prisma Studio GUI for database browsing |
| `npm run db:format` | Format and validate schema.prisma file |

---

## Schema Definition

### Schema Location

The Prisma schema is located in the **shared layer** to centralize database access:

```
api/layers/shared/nodejs/prisma/schema.prisma
```

### Example Model

```prisma
model PurchaseOrder {
  id                    String    @id @default(uuid())
  date                  DateTime  @db.Date
  clientName            String    @map("client_name") @db.VarChar(255)
  poStatus              String    @map("po_status") @db.VarChar(50)
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")
  
  // Relations
  poItems               POItem[]

  // Indexes
  @@index([clientName])
  @@index([poStatus])
  
  // Table name mapping
  @@map("purchase_orders")
}
```

### Key Decorators

| Decorator | Description |
|-----------|-------------|
| `@id` | Primary key |
| `@default(uuid())` | Auto-generate UUID |
| `@default(now())` | Default to current timestamp |
| `@updatedAt` | Auto-update on modification |
| `@map("column_name")` | Map to different column name |
| `@@map("table_name")` | Map to different table name |
| `@db.VarChar(255)` | Specify database column type |
| `@@index([field])` | Create database index |
| `@relation(...)` | Define relationships |

### Field Types

```prisma
String    @db.VarChar(255)     // Variable length string
String    @db.Text             // Long text
Int                            // Integer
Decimal   @db.Decimal(10, 2)   // Decimal with precision
Boolean   @default(true)       // Boolean with default
DateTime  @db.Date             // Date only
DateTime  @default(now())      // Timestamp with default
String?                        // Optional field (nullable)
```

### Naming Conventions

```prisma
model UserProfile {
  id        String @id @default(uuid())
  firstName String @map("first_name")  // Column name in DB (snake_case)
  
  @@map("user_profiles")  // Table name in DB (snake_case)
}
```

### Relationships

```prisma
// One-to-Many
model PurchaseOrder {
  id      String   @id @default(uuid())
  poItems POItem[]  // Has many POItems
}

model POItem {
  id              String        @id @default(uuid())
  purchaseOrderId String        @map("purchase_order_id")
  purchaseOrder   PurchaseOrder @relation(fields: [purchaseOrderId], references: [id], onDelete: Cascade)
}

// Another example with Order and OrderItem
model Order {
  id         String      @id @default(uuid())
  customerId String      @map("customer_id")
  customer   Customer    @relation(fields: [customerId], references: [id])
  items      OrderItem[]
}

model OrderItem {
  id      String @id @default(uuid())
  orderId String @map("order_id")
  order   Order  @relation(fields: [orderId], references: [id], onDelete: Cascade)
}
```

### Indexes

```prisma
model Product {
  id       String @id @default(uuid())
  name     String
  category String
  
  @@index([name])
  @@index([category])
  @@index([name, category])  // Composite index
}
```

---

## Workflow

### Adding a New Table

#### Step 1: Update the Schema

Edit `api/layers/shared/nodejs/prisma/schema.prisma`:

```prisma
model Product {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(255)
  price     Decimal  @db.Decimal(10, 2)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("products")  // Table name in database
}
```

#### Step 2: Create Migration (Local Dev)

```bash
npm run db:migrate
```

- Prisma will prompt you for a migration name (e.g., `add_products_table`)
- Creates a migration file in `prisma/migrations/`
- Applies the migration to your local database
- Regenerates Prisma Client automatically
- **All model types are auto-exported** - no manual export needed!

#### Step 3: Rebuild the Layer

```bash
npm run build:all
```

#### Step 4: Deploy to Production

After deploying your code changes:

```bash
npm run db:migrate:prod
```

### Multiple Tables in One Migration

**Yes, you can create/update multiple tables in a single migration!**

Simply make all your changes to `schema.prisma` before running `npm run db:migrate`:

```prisma
// Add multiple new models at once
model Product {
  id        String   @id @default(uuid())
  name      String   @db.VarChar(255)
  categoryId String  @map("category_id")
  category  Category @relation(fields: [categoryId], references: [id])
  
  @@map("products")
}

model Category {
  id       String    @id @default(uuid())
  name     String    @db.VarChar(100)
  products Product[]
  
  @@map("categories")
}

model Inventory {
  id        String @id @default(uuid())
  productId String @map("product_id")
  quantity  Int
  
  @@map("inventory")
}
```

Then run once:

```bash
npm run db:migrate
# Name it: add_products_categories_inventory
```

This creates a **single migration** with all table creations/changes.

### Updating an Existing Table

#### Step 1: Modify the Schema

Edit the model in `schema.prisma`:

```prisma
model Product {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(255)
  price       Decimal  @db.Decimal(10, 2)
  description String?  // <- New optional field
  isActive    Boolean  @default(true) @map("is_active")  // <- New field with default
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("products")
}
```

#### Step 2: Create Migration

```bash
npm run db:migrate
# Name it descriptively (e.g., add_description_to_products)
```

#### Step 3: Rebuild and Deploy

```bash
npm run build:all
# Deploy your code
npm run db:migrate:prod
```

### Quick Prototyping (No Migration)

For rapid development, push changes directly:

```bash
npm run db:push
```

> **Warning:** This skips migrations and may cause data loss. Use only in development.

---

## Using Prisma in Code

### Lambda Integration

The shared layer provides a Lambda-optimized Prisma client:

```typescript
import { getPrismaClient } from '@arcforge/shared';

// In your repository
const prisma = await getPrismaClient();
const orders = await prisma.purchaseOrder.findMany();
```

Features:
- **Connection pooling** - Reuses connections across warm Lambda invocations
- **Lazy initialization** - Only connects when first query is made
- **Auto-reconnection** - Prisma handles reconnection automatically

### Basic Queries

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create
const po = await prisma.purchaseOrder.create({
  data: {
    date: new Date(),
    clientName: 'ACME Corp',
    poStatus: 'pending',
  },
});

// Read
const orders = await prisma.purchaseOrder.findMany({
  where: { poStatus: 'pending' },
  include: { poItems: true },
  orderBy: { createdAt: 'desc' },
  take: 10,
  skip: 0,
});

// Find one
const order = await prisma.purchaseOrder.findUnique({
  where: { id: 'uuid-here' },
});

// Update
await prisma.purchaseOrder.update({
  where: { id: 'uuid-here' },
  data: { poStatus: 'completed' },
});

// Delete
await prisma.purchaseOrder.delete({
  where: { id: 'uuid-here' },
});
```

### Transactions

```typescript
// Sequential operations in a transaction
const result = await prisma.$transaction([
  prisma.purchaseOrder.create({ data: { ... } }),
  prisma.pOItem.createMany({ data: [...] }),
]);

// Interactive transaction
const result = await prisma.$transaction(async (tx) => {
  const po = await tx.purchaseOrder.create({ data: { ... } });
  await tx.pOItem.create({
    data: { purchaseOrderId: po.id, ... },
  });
  return po;
});
```

### Filtering

```typescript
// Case-insensitive search
const orders = await prisma.purchaseOrder.findMany({
  where: {
    clientName: { contains: 'acme', mode: 'insensitive' },
  },
});

// Multiple conditions (AND)
const orders = await prisma.purchaseOrder.findMany({
  where: {
    AND: [
      { poStatus: 'pending' },
      { clientName: { contains: 'corp' } },
    ],
  },
});

// OR conditions
const orders = await prisma.purchaseOrder.findMany({
  where: {
    OR: [
      { poStatus: 'pending' },
      { poStatus: 'processing' },
    ],
  },
});
```

---

## Prisma Studio

For visual database exploration:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- Browse all tables and records
- Create, update, delete records
- View relationships
- Run filters

---

## Workflow Summary

### Local Development

```
1. Edit schema.prisma (add/modify any number of tables)
2. npm run db:migrate (creates migration + applies it + regenerates client)
3. npm run build:all (rebuilds layer)
4. Test locally - all new types are automatically available!
```

### Production Deployment

```
1. Commit migration files to git
2. Deploy code (CDK/CI-CD)
3. npm run db:migrate:prod (applies pending migrations)
```

---

## Best Practices

1. **Always use migrations in production** - Never use `db:push` in prod
2. **Review generated migrations** - Check SQL before applying
3. **Use descriptive migration names** - e.g., "add-dispatch-tracking-fields"
4. **Keep schema organized** - Group related models together
5. **Use `@@map` for table names** - Follow snake_case for database, camelCase in code
6. **Add indexes for frequently queried fields** - Especially foreign keys and filter fields
7. **Use `onDelete: Cascade`** - For child records that should be deleted with parent

---

## Troubleshooting

### "Cannot find module '@prisma/client'"

```bash
npm run db:generate
```

### "Migration failed"

1. Check your `.env` file has correct `DATABASE_URL`
2. Ensure database is accessible (network/firewall)
3. Check for conflicting schema changes

### "Prisma Client not updated"

Run:
```bash
npm run db:generate
npm run build:all
```

### "Cannot find model X"

After adding new models, ensure you:
1. Run `npm run db:generate`
2. Rebuild with `npm run build:all`

All model types are auto-exported from `@prisma/client` - no manual exports needed.

### "Connection refused"

1. Verify database is running
2. Check host/port settings
3. Ensure security groups/firewall allow connection

### Reset database (development only)

```bash
cd layers/shared/nodejs
npx prisma migrate reset
```

> **Warning:** This deletes all data!

---

## File Locations

| File | Purpose |
|------|---------|
| `api/layers/shared/nodejs/prisma/schema.prisma` | Database schema definition |
| `api/layers/shared/nodejs/prisma/migrations/` | Migration history |
| `api/layers/shared/nodejs/.env` | Local database credentials |
| `api/layers/shared/nodejs/.env.example` | Template for `.env` |
| `api/scripts/db-migrate-prod.js` | Production migration script |

---

---

## Production Database (AWS RDS)

### Environment Setup

| Environment | Database | Managed By |
|-------------|----------|------------|
| dev | Neon/Supabase | Manual (external) |
| qa | Neon/Supabase | Manual (external) |
| prod | AWS RDS PostgreSQL | CDK (automatic) |

### RDS Instance Sizing

Configure in `cdk/config/rds.config.ts`:

| Instance | vCPU | RAM | Cost (Single-AZ) |
|----------|------|-----|------------------|
| db.t4g.micro | 2 | 1 GB | ~$12/month |
| db.t4g.small | 2 | 2 GB | ~$24/month |
| db.t4g.medium | 2 | 4 GB | ~$48/month |

### Data Protection

- **Deletion Protection**: Enabled - prevents accidental deletion
- **RemovalPolicy.SNAPSHOT**: Creates final snapshot if stack is deleted
- **Automated Backups**: 7 days retention (configurable)

### Running Migrations on RDS

#### First Time (After RDS Deployment)

```bash
# Step 1: Deploy the stack (creates RDS instance)
cd cdk
npm run deploy:prod

# Step 2: Run migrations to create all tables
cd ../api
npm run db:migrate:prod
```

#### When Schema Changes

```bash
# Step 1: Edit the schema file
# api/layers/shared/nodejs/prisma/schema.prisma

# Step 2: Create migration locally (against dev database)
cd api
npm run db:migrate
# Enter migration name when prompted: add_new_feature

# Step 3: Test locally to ensure migration works

# Step 4: Commit migration files to git
git add layers/shared/nodejs/prisma/migrations/
git commit -m "Add migration: add_new_feature"

# Step 5: Deploy code changes
cd ../cdk
npm run deploy:prod

# Step 6: Apply migration to production RDS
cd ../api
npm run db:migrate:prod
```

#### What the Migration Script Does

1. **Fetches RDS endpoint** from CloudFormation stack outputs
2. **Fetches credentials** (username/password) from Secrets Manager
3. **Constructs DATABASE_URL** for Prisma
4. **Runs `prisma migrate deploy`** to apply pending migrations

#### Environment Variables (Optional)

You can override auto-detection with environment variables:

```bash
# Custom configuration
DB_HOST=arcforge-db-prod.xxx.rds.amazonaws.com \
DB_SECRET_ID=/arcforge/prod/db \
DB_NAME=arcforge \
AWS_REGION=ap-south-1 \
npm run db:migrate:prod
```

| Variable | Default | Description |
|----------|---------|-------------|
| `AWS_REGION` | `ap-south-1` | AWS region |
| `DB_SECRET_ID` | `/arcforge/prod/db` | Secrets Manager secret ID |
| `DB_HOST` | Auto-detected | RDS endpoint (from CloudFormation) |
| `DB_PORT` | `5432` | Database port |
| `DB_NAME` | `arcforge` | Database name |
| `DB_SSL` | `true` | Enable SSL connection |
| `STACK_NAME` | `ApiStack-prod` | CloudFormation stack name |

### Migration Best Practices

1. **Never run `db:migrate` in production** - Use `db:migrate:prod` which runs `prisma migrate deploy`
2. **Test migrations locally first** - Always run against dev database before production
3. **Migration files are immutable** - Never edit existing migrations after they're applied
4. **Use descriptive names** - e.g., `add_dispatch_tracking`, `update_po_status_enum`
5. **Backup before major changes** - RDS has automated backups, but manual snapshot is recommended

### Troubleshooting RDS Migrations

**"Could not find RDS endpoint in CloudFormation outputs":**
```bash
# RDS is not deployed yet. Deploy the stack first:
cd cdk
npm run deploy:prod
```

**"ResourceNotFoundException" (Secret not found):**
```bash
# Check if secret exists
aws secretsmanager describe-secret --secret-id /arcforge/prod/db

# If not found, RDS stack hasn't been deployed yet
cd cdk
npm run deploy:prod
```

**Connection timeout:**
- Check security group allows your IP (if connecting from local)
- Verify RDS is publicly accessible (for dev/qa) or use VPN/bastion for private
- Check if RDS instance is in "Available" state in AWS Console

**"Password authentication failed":**
```bash
# Verify credentials in Secrets Manager
aws secretsmanager get-secret-value --secret-id /arcforge/prod/db --query SecretString --output text

# Should return: {"username":"oriana_admin","password":"..."}
```

**"Permission denied" (AccessDeniedException):**
```bash
# Ensure your AWS credentials have these permissions:
# - secretsmanager:GetSecretValue
# - cloudformation:DescribeStacks

# Check current identity
aws sts get-caller-identity
```

**Migration stuck or failed midway:**
```bash
# Check migration status
cd layers/shared/nodejs
npx prisma migrate status

# If needed, mark migration as applied (use with caution!)
npx prisma migrate resolve --applied <migration_name>
```

---

*Last updated: 16 December 2025*
