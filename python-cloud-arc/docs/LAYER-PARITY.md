# Layer parity checklist (Node ↔ Python)

Keep this green before each release.

| Node (`node-cloud-arc/api/...`) | Python (`python-cloud-arc/api/...`) | Status |
|----------------------------------|-------------------------------------|--------|
| `layers/shared/nodejs/src/config/` | `layers/shared/python/src/config/` | OK |
| `layers/shared/nodejs/src/database/` | `layers/shared/python/src/database/` (+ `models.py`) | OK |
| `layers/shared/nodejs/src/decorators/` | `layers/shared/python/src/decorators/` | OK |
| `core/handler-factory.ts` | `core/handler_factory.py` | OK |
| `core/router.ts` | `core/router.py` | OK |
| `core/parameter-resolver.ts` | `core/parameter_resolver.py` | OK |
| `core/service-registry.ts` (Inversify) | `core/service_registry.py` + `core/di.py` | OK |
| CSR `services/` + `repositories/` | CSR `services/` + `repositories/` | OK |
| `core/openapi/` | `core/openapi/` (static `api/openapi/` on build) | OK |
| `middleware/authMiddleware.ts` | `middleware/auth.py` | OK |
| `middleware/errorHandler.ts` | `middleware/error_handler.py` | OK |
| `utils/logger.ts` | `utils/logger.py` | OK |
| `utils/secrets.ts` | `utils/secrets.py` | OK |
| `utils/jwt-secrets.ts` | `utils/jwt_secrets.py` | OK |
| `utils/webtoken.ts` | `utils/webtoken.py` | OK |
| `utils/s3.ts` | `utils/s3.py` | OK |
| `layers/shared/DI.md` | `layers/shared/DI.md` | OK |
| `@RequirePermission` / `@RequireModule` | `auth_decorators.py` | OK |
| Express `src/dev-server.ts` | FastAPI `src/dev_server.py` | OK |
| `scripts/merge-manifest.ts` + `build:manifest` | `scripts/generate_manifest.py` | OK |
| `scripts/generate-openapi.ts` + `build:openapi` | `scripts/generate_openapi.py` | OK |
| `openapi/openapi.json` | `openapi/openapi.json` | OK |
| `app-manifest.json` | `app-manifest.json` (generated) | OK |
| `modules/*/lambdas/*.lambda.ts` | `modules/*/lambdas/*.py` | OK |
| `GET /health` (auth lambda) | `GET /health` (auth lambda) | OK |
| `X-Request-Id` + `ALLOWED_ORIGINS` | `request_context.py` | OK |
| Zod `@ApiBody` validation | Pydantic `core/validation.py` | OK |
| Demo + RBAC list pagination | `core/pagination.py` | OK |
| `modules/files` | `modules/files` | OK |
| `scripts/seed-admin.js` | `scripts/seed_admin.py` | OK |
| `.github/workflows/node-ci.yml` | `.github/workflows/python-ci.yml` | OK |
| `cdk/` TypeScript CDK | `cdk/` **Python CDK** (`aws-cdk-lib`) | OK |

**Idiomatic note:** TypeScript uses `experimentalDecorators` + Inversify `@inject(TYPES.X)`. Python uses real decorators and constructor defaults `Inject(TYPES.X)`. CSR, cold-start cache, and JWT gates match. See [CSR-AND-DI.md](CSR-AND-DI.md).
