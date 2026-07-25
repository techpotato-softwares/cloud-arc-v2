# Lambda shared layer

Production layer code lives at **`api/layers/shared/`** (CloudArc layout).

- Build: `cd api && npm run build:layer`
- Alias: `@arcforge/shared` → `@arcforge/shared` (rebrand in progress)
- Framework + Prisma + OpenAPI/Zod validation: `api/layers/shared/nodejs/src/`

A repo-root `layers/shared/` mirror is not used; this README documents the canonical path for initiation-doc alignment.
