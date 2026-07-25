# Local Development Guide

## Overview

This guide explains how to run the ArcForge CloudArc API locally using AWS SAM CLI with optimized development workflows.

## Configuration Architecture

| Config Type | Local (SAM) | AWS (dev/qa/prod) |
|-------------|-------------|-------------------|
| Database connection (host, port, name) | `env.local.json` | Lambda env vars (CDK) |
| Database credentials (user, password) | `env.local.json` | AWS Secrets Manager (`/arcforge/{env}/db`) |
| JWT secrets | `env.local.json` | AWS Secrets Manager (`/arcforge/{env}/jwt`) |
| JWT expiry times | `env.local.json` | Lambda env vars (CDK) |

**Note**: `env.local.json` is **only for local SAM testing**. In AWS:
- Non-sensitive config (expiry times, host, port) → Lambda environment variables via CDK
- Sensitive secrets (passwords, JWT secrets) → Fetched at runtime from AWS Secrets Manager with 5-minute caching

## Prerequisites

- Node.js 22+
- Docker Desktop running
- AWS SAM CLI installed
- PostgreSQL database (Supabase recommended)

## Quick Start

### 1. Set Up Local Environment

```bash
cd cdk
cp env.template.json env.local.json
```

Edit `env.local.json` with your database and JWT credentials:

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

### JWT Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for signing access tokens | Random 32+ character string |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | Random 32+ character string |
| `JWT_EXPIRES_IN` | Access token expiry | `15m`, `30m`, `1h` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | `1d`, `7d`, `30d` |

For local development, you can use simple strings. For production, use strong random secrets (64+ characters).

---

## Development Workflows

### Recommended: Fast Development Mode (dev:fast)

**Best for daily development** - Skips unnecessary rebuilds using smart caching.

```bash
cd cdk
npm run dev:fast
```

**What it does:**
1. Checks if shared layer needs rebuild (skips if cached)
2. Builds Lambda handlers with esbuild
3. Uses cached CDK template if available
4. Starts SAM with EAGER warm containers

**Expected startup time:** ~10-20 seconds (vs 2+ minutes for full build)

### Hot Reload Mode (dev:hot)

**Best for rapid iteration** - Combines esbuild watch with SAM for instant updates.

```bash
cd cdk
npm run dev:hot
```

**What it does:**
1. Starts esbuild in watch mode (rebuilds on file change in ~100ms)
2. Starts SAM with EAGER warm containers
3. Code changes are reflected on next API request

**When to use:** When actively editing Lambda code and testing frequently.

### Full Build Mode (dev:fast --init)

**Use when:** Starting fresh, after pulling changes, or after layer/schema changes.

```bash
cd cdk
npm run dev:fast:init
```

This forces a complete rebuild of everything.

### Express Development Server (Fastest - No Docker)

**Best for maximum speed** - Bypasses Docker/SAM entirely for instant responses.

```bash
# From cdk directory
cd cdk
npm run dev:express:watch

# Or from api directory
cd api
npm run dev:express:watch
```

**What it does:**
1. Runs the API directly in Node.js (no Docker)
2. Auto-restarts on code changes (with ts-node-dev)
3. Provides instant responses (~10-50ms vs 5-10s cold starts)

**Startup time:** ~3-5 seconds

**Trade-offs:**
- ✅ Instant responses (no cold starts)
- ✅ Auto-restart on code changes
- ✅ No Docker required
- ⚠️ Doesn't test Lambda-specific behavior
- ⚠️ Uses different runtime than production

**When to use Express vs SAM:**
| Scenario | Use Express | Use SAM |
|----------|-------------|---------|
| Rapid API development | ✅ | |
| Testing business logic | ✅ | |
| Testing Lambda cold starts | | ✅ |
| Testing Lambda timeouts | | ✅ |
| Final integration testing | | ✅ |

---

## NPM Scripts Reference

### Optimized Development Scripts (Recommended)

| Script | Description | Startup Time |
|--------|-------------|--------------|
| `npm run dev:express:watch` | **Express server (no Docker)** | ~3-5s |
| `npm run dev:fast` | Smart cached build + SAM start | ~10-20s |
| `npm run dev:fast:init` | Force full rebuild + SAM start | ~1-2 min |
| `npm run dev:hot` | Watch mode + SAM (hot reload) | ~10-20s |

### Legacy Development Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Full synth + SAM start (always rebuilds) |
| `npm run dev:fresh` | Clean + full build + start |
| `npm run dev:debug` | Start with debug logging |
| `npm run dev:quick` | Quick synth + SAM start |
| `npm run dev:port` | Start with custom port (set `API_PORT` env var) |
| `npm run dev:watch` | Start with file watcher for restarts |
| `npm run dev:all` | Concurrent watch + SAM |

### API Build Scripts (in api/ directory)

| Script | Description |
|--------|-------------|
| `npm run build` | Build Lambda handlers (esbuild) |
| `npm run build:layer` | Build shared layer (cached) |
| `npm run build:layer:force` | Force rebuild shared layer |
| `npm run build:layer:check` | Check if layer rebuild needed |
| `npm run build:all` | Full build (layer + handlers + manifest) |
| `npm run build:fast` | Layer (cached) + handlers only |
| `npm run watch` | Watch mode for handlers |

---

## Layer Caching

The shared layer build is cached to avoid unnecessary rebuilds. The cache is invalidated when:

- `api/layers/shared/nodejs/src/**/*.ts` files change
- `api/layers/shared/nodejs/package.json` changes
- `api/layers/shared/nodejs/package-lock.json` changes
- `api/layers/shared/nodejs/prisma/schema.prisma` changes
- `api/layers/shared/nodejs/esbuild.config.js` changes

**Cache location:** `api/layers/shared/.layer-hash`

**Force rebuild:**
```bash
cd api
npm run build:layer:force
```

---

## Performance Tips

### 1. Use Warm Containers

All dev scripts now use `--warm-containers EAGER` which keeps Lambda containers warm between requests. This means:
- First request: ~5-10s (cold start)
- Subsequent requests: ~100-200ms (warm)

### 2. Use Watch Mode for Rapid Iteration

When actively coding:
```bash
# Terminal 1 (optional - if not using dev:hot)
cd api && npm run watch

# Terminal 2
cd cdk && npm run dev:fast
```

Changes to Lambda code (~100ms rebuild) are picked up on next request.

### 3. Avoid Full Rebuilds

Only run `dev:fast:init` or `build:all` when:
- First time setup
- After `git pull` with layer changes
- After modifying `prisma/schema.prisma`
- After adding new dependencies to shared layer

### 4. Custom Port

```bash
# Windows PowerShell
$env:API_PORT=5000; npm run dev:fast

# Unix/Mac
API_PORT=5000 npm run dev:fast
```

---

## Typical Development Session

```bash
# Morning: Start fresh session
cd cdk
npm run dev:fast     # Uses cached layer, fast startup

# During development: Active coding
cd cdk
npm run dev:hot      # Hot reload for rapid iteration

# After pulling changes with layer updates
cd cdk
npm run dev:fast:init  # Force full rebuild

# After modifying Prisma schema
cd api
npm run db:migrate     # Run migration
npm run build:layer:force  # Rebuild layer with new schema
cd ../cdk
npm run dev:fast
```

---

## Database Setup with Supabase

1. Create a Supabase project at https://supabase.com
2. Go to **Settings > Database** to find connection info
3. Copy the connection details to `env.local.json`

---

## Troubleshooting

### "connect ECONNREFUSED" Error

Database connection failed. Check:
1. Database credentials in `env.local.json`
2. Database is running and accessible
3. For Supabase, verify `DB_SSL: "true"`

### Function Name in env.local.json

The key must match SAM's logical ID. Find it in `cdk.out/ApiStack-dev.template.json` or SAM output.

### Layer Cache Not Working

If layer keeps rebuilding:
1. Check if `api/layers/shared/.layer-hash` exists
2. Run `npm run build:layer:check` to verify cache status
3. Force rebuild with `npm run build:layer:force`

### Cold Start Too Slow

First request after container restart takes 5-10s. This is normal for Lambda cold starts. Subsequent requests use warm containers (~100ms).

### Changes Not Reflected

If code changes aren't picked up:
1. Ensure you're using `dev:hot` or running `npm run watch` in api/
2. Check that esbuild finished rebuilding (look for build output)
3. Make a new request - SAM picks up changes on next invocation

---

## Security

- **Never commit** `env.local.json` to Git (it's in `.gitignore`)
- Only `env.template.json` is committed (contains placeholder values)
- AWS deployments use Secrets Manager for sensitive credentials:
  - `/arcforge/{env}/db` - Database username and password
  - `/arcforge/{env}/jwt` - JWT_SECRET and JWT_REFRESH_SECRET (auto-generated by CDK)
- **JWT secrets are automatically generated** during CDK deployment - no manual setup needed!
- Secrets are fetched at runtime with 5-minute caching to minimize API calls
- Production enforces that secrets must be present (throws error if missing)

---

## Summary: Which Script to Use?

| Situation | Command | Response Time |
|-----------|---------|---------------|
| **Fastest development** | `npm run dev:express:watch` | ~10-50ms |
| **Daily development (SAM)** | `npm run dev:fast` | ~100ms (warm) |
| **Active coding/testing** | `npm run dev:hot` | ~100ms (warm) |
| **First time / fresh setup** | `npm run dev:fast:init` | ~5-10s (cold) |
| **After git pull** | `npm run dev:fast` | ~100ms (warm) |
| **After schema changes** | `npm run dev:fast:init` | ~5-10s (cold) |
| **Lambda-specific testing** | `npm run dev:fast` | ~100ms (warm) |

### Quick Decision Guide

```
Need instant responses? → npm run dev:express:watch
Need Lambda environment? → npm run dev:fast
Need to test cold starts? → npm run dev (legacy)
```
