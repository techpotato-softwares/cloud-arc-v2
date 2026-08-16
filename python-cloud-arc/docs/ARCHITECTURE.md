# ArcForge Architecture

## Overview

ArcForge is a modular AWS serverless CloudArc sold as **Node** and **Python** kits with the same architectural shape.

```mermaid
flowchart TB
  Client[Client / SPA] --> APIGW[API Gateway]
  APIGW --> NodeL[Node Lambdas + shared layer]
  APIGW --> PyL[Python Lambdas + shared layer]
  NodeL --> SM[Secrets Manager]
  PyL --> SM
  NodeL --> PG[(PostgreSQL)]
  PyL --> PG
  NodeL --> S3[S3]
  PyL --> S3
  PyL --> AI[AI providers]
```

## Request path (both languages)

1. API Gateway invokes a per-module Lambda.
2. Shared layer **handler factory** cold-starts DI/container once, caches router.
3. **Router** matches method/path from decorator registry.
4. Public routes skip JWT (`/api/login`, `/api/auth/refresh`, `GET /health`).
5. Authenticated routes: Bearer JWT → `@RequirePermission` → `@RequireModule`.
6. Controller → Service → Repository (CSR) via DI (`@inject` / `Inject(TYPES.…)`).
7. JSON envelope `{ success, data | error }`. `X-Request-Id` on every response.

## Shared layer modules

| Concern | Node | Python |
|---------|------|--------|
| Config | `layers/shared/nodejs/src/config` | `layers/shared/python/src/config` |
| DB | Prisma | SQLModel / SQLAlchemy |
| Decorators | reflect-metadata | registry decorators |
| DI | Inversify (`defineLambda` + `TYPES`) | `core/di.py` (`define_lambda` + `TYPES` + `Inject`) |
| CSR | `controllers/` `services/` `repositories/` | same folders per module |
| Router / handler factory | `core/` | `core/` |
| Auth / errors | `middleware/` | `middleware/` |
| JWT / secrets / S3 / logger | `utils/` | `utils/` |

See [LAYER-PARITY.md](LAYER-PARITY.md) and the Python CSR/DI guide: [CSR-AND-DI.md](CSR-AND-DI.md).

## Modules

- **platform** (required) — auth, users, roles, permissions, `GET /health`
- **demo** — tutorial CRUD `/api/demo/items` (paginated list)
- **ai** — chat stub / providers (Controller → Service)
- **files** — S3 presign upload/download

## Deploy

CDK under each kit’s `cdk/` reads `api/app-manifest.json` to wire API Gateway routes to handlers.

- Node kit: `npm run build:manifest` (scans `@Controller` metadata)
- Python kit: `python scripts/generate_manifest.py` (same idea)

OpenAPI is generated from request schemas on build:

- Node: Zod + `npm run build:openapi` → `api/openapi/`
- Python: Pydantic `@ApiBody` + `python scripts/generate_openapi.py` → `api/openapi/`

- Node kit: TypeScript CDK (`node-cloud-arc/cdk`)
- Python kit: **Python CDK** (`python-cloud-arc/cdk`, `aws-cdk-lib`)

## Local DX

- Node: Express `node-cloud-arc/api/src/dev-server.ts` → port 4000
- Python: FastAPI `python-cloud-arc/api/src/dev_server.py` → port 4001
