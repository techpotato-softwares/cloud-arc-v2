# Lambda Layer Bundling with esbuild

## Overview

This document explains the esbuild bundling setup for the shared Lambda layer, which was implemented to fix Windows-specific issues with AWS SAM CLI.

## Problem Statement

When running `sam local start-api` on Windows, SAM CLI would fail with:

```
Failed to calculate the hash of resource
Fatal Python error: _PySemaphore_Wakeup: parking_lot: ReleaseSemaphore failed
```

### Root Cause

The `inversify` and `@inversifyjs/core` packages in `node_modules` have **extremely long file paths** (60+ characters) like:

```
node_modules/@inversifyjs/core/lib/cjs/metadata/calculations/buildMaybeClassElementMetadataFromMaybeClassElementMetadata.js.map
```

These paths exceed Windows' 260-character MAX_PATH limit when combined with the project path, causing:
1. SAM CLI's hash calculation to fail
2. PowerShell's `Remove-Item` to fail when cleaning `cdk.out`
3. Slow file operations

## Solution: esbuild Bundling

Instead of copying `node_modules` into the Lambda layer asset, we bundle dependencies into a single file using esbuild.

### Architecture

```
Before (problematic):
api/layers/shared/nodejs/
├── dist/
│   └── index.js          # TypeScript compiled output
├── node_modules/         # ~50MB with long file paths (inversify, sequelize, etc.)
│   ├── @inversifyjs/     # ❌ Long paths break Windows
│   ├── inversify/
│   ├── sequelize/
│   └── ...
└── package.json

After (fixed):
api/layers/shared/bundled/
└── nodejs/               # Required for Lambda to mount at /opt/nodejs/
    ├── dist/
    │   └── index.js      # Single bundled file (~2.7MB) - ALL deps included
    └── package.json
```

**Key Points**:
- Lambda layers for Node.js must have content in a `nodejs/` subdirectory
- This ensures content is mounted at `/opt/nodejs/` when the layer is attached
- ALL dependencies (including `pg`, `sequelize`, `inversify`) are bundled into `dist/index.js`
- No `node_modules` folder needed - everything is in the single bundle

### What Gets Bundled

| Package | Bundled? | Reason |
|---------|----------|--------|
| `inversify` | ✅ Yes | Main cause of long paths |
| `sequelize` | ✅ Yes | Large but bundleable |
| `reflect-metadata` | ✅ Yes | Small, no issues |
| `pg` | ✅ Yes | Pure JS, no native code (pg-native is separate) |
| `pg-hstore` | ✅ Yes | Pure JS postgres utility |
| `@aws-sdk/*` | ❌ No (external) | Already in Lambda runtime |
| `pg-native` | ❌ No (external) | Optional native bindings, not needed |

### Build Process

1. **Layer Build Script** (`scripts/build-layer.js`):
   ```bash
   npm run build:layer
   ```
   
   This script:
   - Installs dependencies in `layers/shared/nodejs`
   - Runs esbuild to bundle into `dist/index.js`
   - Creates `bundled/` output directory
   - Copies only bundled dist + minimal pg modules

2. **esbuild Configuration** (`layers/shared/nodejs/esbuild.config.js`):
   ```javascript
   const buildOptions = {
     entryPoints: ['src/index.ts'],
     bundle: true,
     platform: 'node',
     target: 'node22',
     outdir: 'dist',
     format: 'cjs',
     external: [
       'pg-native',    // Optional native bindings, not needed
       '@aws-sdk/*',   // Already in Lambda runtime
     ],
   };
   ```

3. **CDK Asset Path** (`cdk/lib/stacks/api-stack.ts`):
   ```typescript
   code: lambda.Code.fromAsset(
     path.join(__dirname, '../../../api/layers/shared/bundled')
   )
   ```

## Usage

### Full Build
```bash
cd api
npm run build:all
```

### Layer Only
```bash
cd api
npm run build:layer
```

### Start Local Development
```bash
cd cdk
npm run dev:fresh  # Cleans cdk.out first
# or
npm run dev        # Uses existing cdk.out
```

## Troubleshooting

### "Failed to calculate hash" Error
1. Clean cdk.out using rimraf (handles long paths):
   ```bash
   cd cdk
   npx rimraf cdk.out
   ```
   Or use robocopy trick:
   ```powershell
   New-Item -ItemType Directory -Force -Path empty_temp | Out-Null
   robocopy empty_temp cdk.out /MIR /NFL /NDL /NJH /NJS
   Remove-Item -Force empty_temp
   ```

2. Rebuild layer:
   ```bash
   cd api
   npm run build:layer
   ```

3. Re-synth and start:
   ```bash
   cd cdk
   npm run dev
   ```

### "Please install pg package manually" Error

**Problem**: Lambda runtime error when hitting an endpoint:
```
Error: Please install pg package manually
    at _ConnectionManager._loadDialectModule (/opt/nodejs/dist/index.js:...)
```

**Root Cause**: The `pg` package was marked as `external` in esbuild config, expecting it to be in a separate `node_modules`. However, when the bundled code at `/opt/nodejs/dist/index.js` tries to `require('pg')`, Node.js module resolution doesn't find it because:
- It looks in `/opt/nodejs/dist/node_modules/` (doesn't exist)
- The separate `node_modules` at `/opt/nodejs/node_modules/` isn't in the resolution path

**Solution**: Bundle `pg` along with all other dependencies. The `pg` package is pure JavaScript - it does NOT have native C bindings. Only `pg-native` (optional) has native code.

**Fix Applied**:

| File | Change |
|------|--------|
| `layers/shared/nodejs/esbuild.config.js` | Changed externals from `['pg', 'pg-native', 'pg-hstore', '@aws-sdk/*']` to `['pg-native', '@aws-sdk/*']` |
| `layers/shared/nodejs/src/database/index.ts` | Added `import * as pg from 'pg'` and `dialectModule: pg` in Sequelize options |
| `layers/shared/nodejs/package.json` | Added `@types/pg` to devDependencies |
| `scripts/build-layer.js` | Removed pg module copying - not needed anymore |

**Key Fix - dialectModule**:

Sequelize uses dynamic `require()` to load database drivers:
```javascript
// In Sequelize source (can't be bundled by esbuild)
return require(moduleName);  // moduleName = "pg"
```

esbuild can't statically analyze dynamic requires. The solution is to pass the pg module directly:

```typescript
// In database/index.ts
import * as pg from 'pg';

const options = {
  dialect: 'postgres',
  dialectModule: pg,  // ← Bypasses dynamic require!
  // ...
};
```

**Result**: Single bundled file (~2.85MB) with ALL dependencies including pg, sequelize, inversify.

### "Cannot find module '/opt/nodejs/dist'" Error

**Problem**: Lambda can't find the shared layer:
```
Error: Cannot find module '/opt/nodejs/dist'
```

**Root Cause**: Layer content not in correct directory structure. Lambda layers for Node.js must have content in a `nodejs/` subdirectory.

**Solution**: Ensure bundled output has this structure:
```
bundled/
└── nodejs/          ← Required!
    ├── dist/
    │   └── index.js
    └── package.json
```

**Fix Applied** in `scripts/build-layer.js`:
```javascript
// Create nodejs subdirectory (Lambda layer convention)
const nodejsPath = path.join(bundledOutputPath, 'nodejs');
fs.mkdirSync(nodejsPath, { recursive: true });
```

### Layer Size
After bundling:
- **dist/index.js**: ~2.7 MB (single bundled file with ALL dependencies)
- **No node_modules needed** - everything bundled
- **Total**: ~2.7 MB

Before bundling:
- **node_modules/**: ~50+ MB with problematic long paths

## Files Modified

| File | Purpose |
|------|---------|
| `api/layers/shared/nodejs/esbuild.config.js` | esbuild config for layer bundling |
| `api/layers/shared/nodejs/package.json` | Added esbuild and @types/pg devDeps, updated build script |
| `api/layers/shared/nodejs/src/database/index.ts` | Added `dialectModule: pg` to bypass Sequelize's dynamic require |
| `api/layers/shared/nodejs/src/decorators/registry.ts` | Fixed handler path generation (`${name}.handler` not `.handler.handler`) |
| `api/scripts/build-layer.js` | Main build script for bundled layer with `nodejs/` directory |
| `api/esbuild.config.js` | Output `po.js` instead of `po.handler.js` |
| `api/package.json` | Updated `build:layer` script |
| `cdk/lib/stacks/api-stack.ts` | Points to bundled layer output |
| `cdk/package.json` | Added rimraf, updated dev scripts |

## Lambda Handler Path

The Lambda handler path format is:
```
dist/handlers/{name}.handler
```

Where:
- `dist/handlers/{name}.js` is the compiled handler file
- `.handler` refers to the exported `handler` function

Example: `dist/handlers/po.handler` loads `dist/handlers/po.js` and calls `exports.handler`

### Handler Path Fix

**Problem**: Lambda runtime error "Cannot find module 'po'"

The original setup had handler files named `{name}.handler.ts` (e.g., `po.handler.ts`) which compiled to `po.handler.js`. The manifest generated handler paths like:

```
dist/handlers/po.handler.handler  ❌ Too many dots!
```

Lambda parses handler paths by splitting on the **last** dot:
- `dist/handlers/po.handler.handler` → Module: `dist/handlers/po.handler`, Export: `handler` ✅

But with multiple dots in the filename, some Lambda runtime versions incorrectly parse:
- Module: `po`, Export: `handler.handler` ❌

**Solution**: Simplify the output filename and handler path.

| File | Before | After |
|------|--------|-------|
| `api/esbuild.config.js` | `outdir: 'dist/handlers'` (creates `po.handler.js`) | `outfile: 'dist/handlers/po.js'` |
| `api/layers/shared/nodejs/src/decorators/registry.ts` | `handler: dist/handlers/${name}.handler.handler` | `handler: dist/handlers/${name}.handler` |
| Generated manifest | `dist/handlers/po.handler.handler` | `dist/handlers/po.handler` |

**Result**:
```
Handler: dist/handlers/po.handler
    ↓
File: dist/handlers/po.js
Export: handler (from exports.handler)
```

### Handler Configuration Files

| File | Purpose |
|------|---------|
| `api/esbuild.config.js` | Outputs handler to `dist/handlers/{name}.js` |
| `api/layers/shared/nodejs/src/decorators/registry.ts` | Generates handler path `dist/handlers/{name}.handler` in manifest |
| `api/src/handlers/{name}.handler.ts` | Source file exports `handler` function |

### Adding New Handlers

When adding a new Lambda handler (e.g., `dispatch`):

1. **Create handler source**: `api/src/handlers/dispatch.handler.ts`
   ```typescript
   export const handler = async (event, context) => { ... };
   ```

2. **Update esbuild config** (`api/esbuild.config.js`):
   ```javascript
   // For multiple handlers, change back to outdir with explicit naming:
   entryPoints: {
     'po': 'src/handlers/po.handler.ts',
     'dispatch': 'src/handlers/dispatch.handler.ts',
   },
   outdir: 'dist/handlers',
   ```

3. **Create controller** with `@Controller` decorator specifying `lambdaName: 'dispatch'`

4. **Rebuild**: `npm run build:all`

The manifest will automatically generate the correct handler path: `dist/handlers/dispatch.handler`

## Benefits

1. **Windows Compatibility**: No more long path issues
2. **Faster Builds**: Single file vs thousands of files
3. **Smaller Assets**: ~3MB vs ~50MB
4. **Faster SAM Startup**: Less files to hash and mount
5. **Consistent Behavior**: Same bundle on Windows/Mac/Linux

