# Shared Layer Path Alias Implementation

This document describes the implementation of the `@arcforge/shared` path alias for cleaner imports from the shared Lambda layer.

## Overview

Previously, imports from the shared layer used the Lambda runtime path `/opt/nodejs/dist` which was verbose and confusing:

```typescript
// Before
import { Controller, Get } from '/opt/nodejs/dist';
```

Now, we use a cleaner alias:

```typescript
// After
import { Controller, Get } from '@arcforge/shared';
```

## How It Works

The alias system works at two levels:

### 1. TypeScript Compilation (Development)

TypeScript needs to understand `@arcforge/shared` for type checking and IntelliSense.

**File: `api/tsconfig.json`**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@arcforge/shared": ["./layers/shared/nodejs/src"],
      "@arcforge/shared/*": ["./layers/shared/nodejs/src/*"],
      "/opt/nodejs/dist": ["./layers/shared/nodejs/src"],
      "/opt/nodejs/dist/*": ["./layers/shared/nodejs/src/*"]
    }
  }
}
```

### 2. Esbuild Bundling (Build Time)

Esbuild needs to transform `@arcforge/shared` imports to `/opt/nodejs/dist` in the output bundle, since that's where the Lambda layer is mounted at runtime.

**File: `api/esbuild.config.js`**

```javascript
// Plugin to rewrite @arcforge/shared imports to /opt/nodejs/dist (Lambda layer path)
const sharedLayerPlugin = {
  name: 'shared-layer-alias',
  setup(build) {
    // Intercept @arcforge/shared imports BEFORE default resolution
    build.onResolve({ filter: /^@arcforge\/shared/ }, (args) => {
      // Handle both @arcforge/shared and @arcforge/shared/subpath
      if (args.path === '@arcforge/shared') {
        return { path: '/opt/nodejs/dist', external: true };
      }
      const subpath = args.path.replace('@arcforge/shared/', '');
      return { path: `/opt/nodejs/dist/${subpath}`, external: true };
    });
  },
};

const buildOptions = {
  // ... other options
  // Prevent esbuild from using tsconfig paths (our plugin handles resolution)
  tsconfigRaw: JSON.stringify({
    compilerOptions: {
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
  }),
  plugins: [sharedLayerPlugin],
};
```

Key points:
- The `onResolve` hook intercepts `@arcforge/shared` imports
- It returns `{ external: true }` so esbuild doesn't bundle the code
- It rewrites the path to `/opt/nodejs/dist` for Lambda runtime
- `tsconfigRaw` prevents esbuild from using tsconfig paths (which would resolve to local files)

### 3. ts-node (Build Scripts)

For build scripts like `generate-manifest.ts` that run via ts-node, we use `tsconfig-paths` to enable path alias resolution.

**File: `api/package.json`**
```json
{
  "scripts": {
    "build:manifest": "ts-node -r tsconfig-paths/register scripts/generate-manifest.ts"
  },
  "devDependencies": {
    "tsconfig-paths": "^4.2.0"
  }
}
```

## Files Modified

### 1. `api/tsconfig.json`
- Added `@arcforge/shared` and `@arcforge/shared/*` path mappings

### 2. `api/esbuild.config.js`
- Added `sharedLayerPlugin` to rewrite imports
- Added `tsconfigRaw` to override tsconfig path resolution
- Removed the old `alias` option (doesn't work with external modules)

### 3. `api/package.json`
- Updated `build:manifest` script to use `tsconfig-paths/register`
- Added `tsconfig-paths` as devDependency

### 4. Source Files Updated
- `api/src/handlers/po.handler.ts`
- `api/src/controllers/POController.ts`
- `api/src/container/po.container.ts`
- `api/scripts/generate-manifest.ts`

All imports changed from:
```typescript
import { ... } from '/opt/nodejs/dist';
```
To:
```typescript
import { ... } from '@arcforge/shared';
```

## Additional Fixes

### reflect-metadata Version

Updated `reflect-metadata` from `^0.1.14` to `^0.2.2` in:
- `api/package.json`
- `api/layers/shared/nodejs/package.json`

This was required because `inversify@6.2.2` requires `reflect-metadata@~0.2.2` as a peer dependency.

### TypeScript Compatibility Fixes

Fixed TypeScript errors caused by stricter types in the newer reflect-metadata:

1. **`api/layers/shared/nodejs/src/decorators/param.decorator.ts`**
   - Updated `createParamDecorator` signature to handle `propertyKey: string | symbol | undefined`

2. **`api/layers/shared/nodejs/src/core/router.ts`**
   - Added type cast `as object` for `controllerInstance`

3. **`api/layers/shared/nodejs/src/utils/logger.ts`**
   - Fixed spread operator issue with `data` parameter

## Build Output

After building, the bundled output correctly contains:

```javascript
var import_shared = require("/opt/nodejs/dist");
```

This ensures the Lambda function will load the shared code from the Lambda layer at runtime.

## Usage

### Adding New Imports

When importing from the shared layer, always use:
```typescript
import { Something } from '@arcforge/shared';
```

### Available Exports

The shared layer exports (from `layers/shared/nodejs/src/index.ts`):
- **Config**: `getAppConfig`
- **Database**: `getSequelize`, `closeConnection`, `Sequelize`, `DataTypes`, `Model`, `Op`, etc.
- **Utilities**: `logger`, `getDatabaseConfig`
- **Middleware**: `createSuccessResponse`, `createErrorResponse`, `handleOptions`, error classes
- **Decorators**: `Controller`, `Get`, `Post`, `Put`, `Delete`, `Patch`, `Param`, `Query`, `Body`, `Event`, `Headers`, `Context`
- **Core**: `Router`, `createRouter`, `parameterResolver`, `routeRegistry`

## Troubleshooting

### "Cannot find module '@arcforge/shared'"

1. **In IDE**: Restart TypeScript server (Ctrl+Shift+P → "TypeScript: Restart TS Server")
2. **During build:manifest**: Ensure `tsconfig-paths` is installed and script uses `-r tsconfig-paths/register`
3. **During esbuild**: Check that `sharedLayerPlugin` is in the plugins array

### Bundle includes shared layer code instead of external require

Check that:
1. `tsconfigRaw` is set in esbuild config (prevents tsconfig path resolution)
2. Plugin is returning `{ external: true }`
3. No other plugins are resolving `@arcforge/shared` before our plugin

