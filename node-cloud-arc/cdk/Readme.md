# ArcForge CloudArc - CDK Infrastructure

AWS CDK infrastructure for the ArcForge CloudArc API with decorator-based routing.

## Prerequisites

Before running the project locally, you **must** install the following tools:

| Tool | Version | Required For | Download Link |
|------|---------|--------------|---------------|
| **Node.js** | 22.x+ | Running CDK & API | [nodejs.org](https://nodejs.org/) |
| **AWS CLI** | v2 | AWS credentials & SAM dependency | [AWS CLI Install Guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) |
| **AWS SAM CLI** | Latest | **Local Lambda development** | [SAM CLI Install Guide](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) |
| **Docker Desktop** | Latest | **Required by SAM CLI** | [Docker Desktop](https://www.docker.com/products/docker-desktop/) |

> ⚠️ **Important**: SAM CLI and Docker are **required** to run `npm run dev`. SAM CLI uses Docker to simulate the Lambda environment locally.

### Verify Installation

```bash
# Check Node.js
node --version        # Should be v22.x or later

# Check AWS CLI
aws --version         # Should be aws-cli/2.x.x

# Check SAM CLI
sam --version         # Should be SAM CLI, version 1.x.x

# Check Docker is running
docker --version      # Should be Docker version 2x.x.x
docker info           # Should show Docker daemon is running

# Configure AWS credentials (if not done)
aws configure
```

### Docker Must Be Running

Before running `npm run dev`, ensure Docker Desktop is **started and running**. You can verify with:

```bash
docker info
# If this fails, start Docker Desktop first
```

## How It Works

```
Build Time:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Controllers    │ ──► │  Build Script    │ ──► │ app-manifest.json│
│  with Decorators│     │  (scan & extract)│     │                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘

CDK Synth Time:
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ app-manifest.json│ ──► │  CDK Stack       │ ──► │ API Gateway     │
│                 │     │  (read manifest) │     │ Routes          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

1. Controllers define routes using decorators (`@Get`, `@Post`, etc.)
2. Build script scans controllers and generates `app-manifest.json`
3. CDK reads the manifest and creates API Gateway routes automatically

## Project Structure

```
cdk/
├── bin/
│   └── cdk.ts                      # CDK app entry point
├── config/                         # Service-specific configurations
│   ├── index.ts                    # Exports all configs
│   ├── s3.config.ts                # S3 bucket configurations
│   └── rds.config.ts               # RDS database configurations
├── lib/
│   ├── config/
│   │   └── environment.ts          # Environment configs & feature flags
│   ├── constructs/
│   │   ├── core/
│   │   │   ├── lambda-construct.ts
│   │   │   └── api-gateway-construct.ts
│   │   ├── storage/
│   │   │   └── s3-construct.ts     # S3 bucket creation
│   │   ├── database/
│   │   │   └── rds-construct.ts    # RDS PostgreSQL database
│   │   ├── hosting/
│   │   │   └── static-site-construct.ts  # UI hosting (S3 + CloudFront)
│   │   └── permissions/
│   │       └── lambda-permissions.ts
│   ├── stacks/
│   │   └── api-stack.ts            # Main API stack
│   └── utils/
│       └── manifest-reader.ts      # Reads app-manifest.json
├── events/                         # Test event payloads
│   ├── po-create.json
│   └── po-list.json
├── env.local.json                  # Local environment variables
├── cdk.json                        # CDK configuration
├── package.json
└── tsconfig.json
```

## Setup

```bash
# Install dependencies
cd cdk
npm install

# Bootstrap CDK (first time only)
npm run bootstrap
```

## Local Development

### Step 1: Configure Environment Variables

Copy `env.template.json` to `env.local.json` and fill in your values:

```bash
cd cdk
cp env.template.json env.local.json
```

Edit `cdk/env.local.json` with your database and JWT credentials:

```json
{
  "arcforge-po-dev": {
    "ENVIRONMENT": "dev",
    "IS_LOCAL": "true",
    "DB_HOST": "db.xxxxxxxxxxxx.supabase.co",
    "DB_PORT": "5432",
    "DB_NAME": "postgres",
    "DB_USERNAME": "postgres",
    "DB_PASSWORD": "your-supabase-password",
    "DB_SSL": "true",
    "LOG_LEVEL": "DEBUG",
    "JWT_SECRET": "your-local-dev-jwt-secret-at-least-32-chars",
    "JWT_REFRESH_SECRET": "your-local-dev-refresh-secret-at-least-32-chars",
    "JWT_EXPIRES_IN": "15m",
    "JWT_REFRESH_EXPIRES_IN": "1d"
  }
}
```

**Note:** `env.local.json` is gitignored and should never be committed.

### Step 2: Start Development Server

**Option A: Fast Development (Recommended for Daily Work)**
```bash
cd cdk
npm run dev:fast
```
Uses smart caching to skip unnecessary rebuilds. Startup time: ~10-20 seconds.

**Option B: Hot Reload Mode (Best for Active Coding)**
```bash
cd cdk
npm run dev:hot
```
Combines esbuild watch + SAM for instant code updates (~100ms rebuild).

**Option C: Full Rebuild (After Git Pull or Schema Changes)**
```bash
cd cdk
npm run dev:fast:init
```
Forces complete rebuild of layer, handlers, and CDK template.

**Option D: Legacy Commands**
```bash
cd cdk
npm run dev          # Full build + synth + start
npm run dev:all      # Concurrent watch + SAM
npm run dev:quick    # Quick start (skip API build)
npm run dev:debug    # Debug mode
```

The API will be available at: `http://localhost:4000`

### Which Script Should I Use?

| Situation | Command |
|-----------|---------|
| **Fastest development (no Docker)** | `npm run dev:express:watch` |
| **Daily development (SAM)** | `npm run dev:fast` |
| **Active coding/testing** | `npm run dev:hot` or `dev:express:watch` |
| **First time / fresh setup** | `npm run dev:fast:init` |
| **After git pull** | `npm run dev:fast` (or `dev:fast:init` if layer changed) |
| **After schema changes** | `npm run dev:fast:init` |
| **Testing Lambda behavior** | `npm run dev:fast` |

### How Hot Reload Works

The optimized hot reload flow uses a simple signal-based approach:

1. **esbuild watch mode** rebuilds TypeScript → writes `api/dist/.restart` signal file
2. **Native file watcher** detects signal file change → restarts SAM automatically
3. **No external dependencies** - uses Node.js built-in `fs.watchFile`

When you edit code:
- esbuild rebuilds → signal file updated
- SAM restarts automatically
- Changes are live instantly!

This approach is simpler, faster, and has zero external dependencies beyond what's already in the project.

### Using a Custom Port

The default port is `4000` to avoid conflicts with UI development servers (which typically use 3000).

**Option 1: Use the configurable script**
```bash
# Windows PowerShell
$env:API_PORT=5000; npm run dev:port

# Windows CMD
set API_PORT=5000 && npm run dev:port

# Mac/Linux
API_PORT=5000 npm run dev:port
```

**Option 2: Run SAM manually**
```bash
npm run synth:dev && sam local start-api -p 5000 -t cdk.out/ApiStack-dev.template.json --env-vars env.local.json --warm-containers LAZY --skip-pull-image
```

## NPM Scripts

### Optimized Development (Recommended)
| Script | Description | Startup Time |
|--------|-------------|--------------|
| `npm run dev:express:watch` | **Express server (no Docker)** - Fastest, instant responses | ~3-5s |
| `npm run dev:fast` | **Smart cached build** - Skips layer/synth if cached | ~10-20s |
| `npm run dev:fast:init` | **Force full rebuild** - Use after git pull or schema changes | ~1-2 min |
| `npm run dev:hot` | **Hot reload mode** - Watch + SAM with instant updates | ~10-20s |

### Legacy Development
| Script | Description |
|--------|-------------|
| `npm run dev:all` | Runs API watch + SAM with hot reload |
| `npm run dev:watch` | Synth + Start SAM with auto-restart on code changes |
| `npm run dev` | Build API + Synth + Start local API on port 4000 |
| `npm run dev:port` | Same as dev, but uses `API_PORT` env var (default: 4000) |
| `npm run dev:quick` | Synth + Start (skip API build) |
| `npm run dev:debug` | Debug mode with verbose logging |
| `npm run invoke:po` | Invoke PO Lambda locally |
| `npm run invoke:po:event` | Invoke with test event |

### Build Commands
| Script | Description |
|--------|-------------|
| `npm run build` | Compile CDK TypeScript |
| `npm run build:api` | Build API + generate manifest |
| `npm run build:ui` | Build UI (React) |
| `npm run build:all` | Build both API + UI |
| `npm run synth:dev` | Synthesize dev stack |
| `npm run synth:qa` | Synthesize QA stack |
| `npm run synth:prod` | Synthesize prod stack |

### Deployment - Full (API + UI)
| Script | Description |
|--------|-------------|
| `npm run deploy:dev` | Build API + UI + Deploy to dev |
| `npm run deploy:qa` | Build API + UI + Deploy to QA |
| `npm run deploy:prod` | Build API + UI + Deploy to production |

### Deployment - API Only (Faster)
| Script | Description |
|--------|-------------|
| `npm run deploy:api:dev` | Build API only + Deploy to dev |
| `npm run deploy:api:qa` | Build API only + Deploy to QA |
| `npm run deploy:api:prod` | Build API only + Deploy to production |

### Other Commands
| Script | Description |
|--------|-------------|
| `npm run diff:dev` | Show changes for dev |
| `npm run destroy:dev` | Destroy dev stack |
| `npm run bootstrap` | Bootstrap CDK |

## App Manifest

CDK reads `api/app-manifest.json` to create API Gateway routes:

```json
{
  "version": "1.0",
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

### Adding New Routes

1. Add decorator to controller method:
```typescript
@Get('/search')
async search(@Query('q') query: string) { }
```

2. Rebuild manifest and synth:
```bash
cd api && npm run build:manifest
cd ../cdk && npm run synth:dev
```

Routes are automatically added to API Gateway!

## Environment-Specific Configuration

| Environment | Stack Name | Database | Memory | UI Hosting | RDS | JWT Expiry |
|-------------|------------|----------|--------|------------|-----|------------|
| dev | ApiStack-dev | Neon/Supabase | 256 MB | ✅ CloudFront | ❌ | 15m / 1d |
| qa | ApiStack-qa | Neon/Supabase | 512 MB | ✅ CloudFront | ❌ | 15m / 7d |
| prod | ApiStack-prod | AWS RDS | 1024 MB | ✅ CloudFront | ✅ | 30m / 30d |

### Secrets Configuration

| Secret Type | Local Dev | QA/Prod |
|-------------|-----------|---------|
| Database credentials | `env.local.json` | AWS Secrets Manager (`/arcforge/{env}/db`) |
| JWT secrets | `env.local.json` | AWS Secrets Manager (`/arcforge/{env}/jwt`) |
| JWT expiry times | `env.local.json` | CDK environment config (Lambda env vars) |

### Feature Flags

Configure in `cdk/lib/config/environment.ts`:

```typescript
features: {
  s3: true,         // S3 buckets for file storage
  staticSite: true, // UI hosting (S3 + CloudFront)
  rds: true,        // AWS RDS PostgreSQL (prod only recommended)
}
```

### Infrastructure Created

| Resource | Dev/QA | Production |
|----------|--------|------------|
| Lambda Functions | ✅ | ✅ |
| API Gateway | ✅ | ✅ |
| S3 Buckets (uploads, documents) | ✅ | ✅ (RETAIN) |
| UI Hosting (S3 + CloudFront) | ✅ | ✅ (RETAIN) |
| RDS PostgreSQL | ❌ | ✅ (SNAPSHOT on delete) |
| VPC | ❌ | ✅ (for RDS) |

### Data Protection

Production resources use `RemovalPolicy.RETAIN` or `RemovalPolicy.SNAPSHOT`:
- **S3 Buckets**: Won't be deleted on stack updates
- **RDS Database**: Creates final snapshot before any deletion
- **RDS Deletion Protection**: Enabled for production

## Performance Optimizations

- **ARM64 Architecture**: 20% better price-performance
- **Connection Reuse**: `AWS_NODEJS_CONNECTION_REUSE_ENABLED=1`
- **esbuild**: ~100x faster builds
- **Manifest-based routing**: No runtime route scanning
- **Layer caching**: Shared layer builds are cached (hash-based) to skip unnecessary rebuilds
- **EAGER warm containers**: Keeps Lambda containers warm for fast subsequent requests (~100ms vs 5-10s cold start)

### Layer Caching

The shared layer build is cached based on file content hashes. Rebuilds are skipped when:
- Source files (`api/layers/shared/nodejs/src/**`) haven't changed
- `package.json` and `package-lock.json` are unchanged
- `prisma/schema.prisma` is unchanged

**Cache location:** `api/layers/shared/.layer-hash`

**Force rebuild:**
```bash
cd api
npm run build:layer:force
```

**Check cache status:**
```bash
cd api
npm run build:layer:check  # Exit 0 = cached, Exit 1 = needs rebuild
```

## UI Deployment (Static Site Hosting)

The UI is automatically deployed to S3 + CloudFront when you run `npm run deploy:dev`.

### Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Route53   │────▶│  CloudFront │────▶│  S3 Bucket  │
│ (Optional)  │     │    (CDN)    │     │(Static Site)│
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │  ACM Cert   │
                    │(Free HTTPS) │
                    └─────────────┘
```

### Features

- **CloudFront CDN**: Global edge caching for fast load times
- **HTTPS**: Automatic HTTPS with CloudFront's default certificate
- **SPA Routing**: 404/403 errors redirect to index.html for client-side routing
- **Cache Invalidation**: Automatic cache invalidation on each deploy
- **Cost Optimized**: Uses PRICE_CLASS_100 for non-prod (cheaper, fewer edge locations)

### Outputs

After deployment, you'll see:
```
Outputs:
StaticSiteConstruct.WebsiteURL = https://d1234567890.cloudfront.net
StaticSiteConstruct.WebsiteBucketName = arcforge-ui-dev
StaticSiteConstruct.DistributionId = E1234567890
```

### Estimated Costs

| Service | Monthly Cost |
|---------|-------------|
| S3 Storage | ~$0.01-0.05 |
| CloudFront (first 1TB free) | $0 |
| **Total** | **~$0.50-1/month** |

## RDS Database (Production Only)

Production environment uses AWS RDS PostgreSQL.

### Configuration

Edit `cdk/config/rds.config.ts`:

```typescript
prod: {
  instanceClass: ec2.InstanceClass.T4G,
  instanceSize: ec2.InstanceSize.MICRO, // ~$12/month (cheapest)
  allocatedStorage: 20,
  multiAz: false, // Enable for high availability (~2x cost)
  deletionProtection: true,
}
```

### Instance Sizes & Costs

| Instance | vCPU/RAM | Single-AZ | Multi-AZ |
|----------|----------|-----------|----------|
| db.t4g.micro | 2/1GB | ~$12/mo | ~$24/mo |
| db.t4g.small | 2/2GB | ~$24/mo | ~$48/mo |
| db.t4g.medium | 2/4GB | ~$48/mo | ~$96/mo |

### Data Protection

- **Deletion Protection**: Enabled (prevents accidental deletion)
- **RemovalPolicy.SNAPSHOT**: Creates final snapshot if stack is deleted
- **Automated Backups**: 7 days retention

### Database Credentials

Credentials are automatically stored in AWS Secrets Manager at `/arcforge/prod/db`.

```bash
# Retrieve credentials
aws secretsmanager get-secret-value --secret-id /arcforge/prod/db
```

## Secrets Manager Setup

### Database Secrets

```bash
# Create database secrets for each environment
aws secretsmanager create-secret \
  --name /arcforge/dev/db \
  --secret-string '{"username":"postgres","password":"your-db-password"}'

aws secretsmanager create-secret \
  --name /arcforge/qa/db \
  --secret-string '{"username":"postgres","password":"your-qa-db-password"}'

aws secretsmanager create-secret \
  --name /arcforge/prod/db \
  --secret-string '{"username":"postgres","password":"your-prod-db-password"}'
```

### JWT Secrets (Automatically Generated)

JWT secrets (`JWT_SECRET` and `JWT_REFRESH_SECRET`) are **automatically generated by CDK** during deployment. No manual secret creation is required!

**How it works:**
- CDK creates a `JwtSecretsConstruct` that generates cryptographically secure random secrets
- Secrets are stored in AWS Secrets Manager at `/arcforge/{env}/jwt`
- Each environment (dev, qa, prod) gets its own unique secrets
- Production secrets use `RemovalPolicy.RETAIN` to prevent accidental deletion

**For local development:**
- JWT secrets are read from `env.local.json` (not from Secrets Manager)
- Copy `env.template.json` to `env.local.json` and add your local secrets

**Secret structure in Secrets Manager:**
```json
{
  "JWT_SECRET": "<auto-generated-128-char-string>",
  "JWT_REFRESH_SECRET": "<auto-generated-128-char-string>"
}
```

**View deployed secrets (if needed):**
```bash
# Retrieve JWT secrets (for debugging only - don't log these!)
aws secretsmanager get-secret-value --secret-id /arcforge/prod/jwt --query SecretString --output text
```

### Retrieve Secrets

```bash
# Retrieve database credentials
aws secretsmanager get-secret-value --secret-id /arcforge/prod/db

# Retrieve JWT secrets
aws secretsmanager get-secret-value --secret-id /arcforge/prod/jwt
```

## Troubleshooting

### SAM CLI not found
```bash
# Install SAM CLI first
# Windows: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html
# Verify installation
sam --version
```

### Docker not running
SAM CLI requires Docker to simulate the Lambda environment.

```bash
# Check if Docker is running
docker info

# If not running, start Docker Desktop first, then retry
npm run dev
```

### Manifest not found
```bash
cd api && npm run build:manifest
```

### Routes not updating
```bash
cd api && npm run build:all
cd ../cdk && npm run synth:dev
```

### Port already in use
```bash
# Windows PowerShell - check what's using the port
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# Or just use a different port (e.g., 5000)
npm run synth:dev && sam local start-api -p 5000 -t cdk.out/ApiStack-dev.template.json --env-vars env.local.json --warm-containers LAZY --skip-pull-image
```

### AWS credentials not configured
```bash
# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1), Output format (json)
```
