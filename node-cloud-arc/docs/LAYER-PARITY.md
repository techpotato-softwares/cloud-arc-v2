# Layer parity checklist (Node ↔ Python)

Keep this green before each release. CI should fail if a Node layer path has no Python counterpart.

| Node (`node-cloud-arc/api/layers/shared/nodejs/src`) | Python (`python-cloud-arc/layers/shared/python/src`) | Status |
|---------------------------------------|--------------------------------------------|--------|
| `config/` | `config/` | OK |
| `database/` | `database/` (+ `models.py`) | OK |
| `decorators/` | `decorators/` | OK |
| `core/handler-factory.ts` | `core/handler_factory.py` | OK |
| `core/router.ts` | `core/router.py` | OK |
| `core/parameter-resolver.ts` | `core/parameter_resolver.py` | OK |
| `core/service-registry.ts` | `core/service_registry.py` + `core/di.py` | OK |
| CSR `services/` + `repositories/` | CSR `services/` + `repositories/` | OK |
| `core/openapi/` | `core/openapi/` + FastAPI OpenAPI | OK |
| `middleware/authMiddleware.ts` | `middleware/auth.py` | OK |
| `middleware/errorHandler.ts` | `middleware/error_handler.py` | OK |
| `utils/logger.ts` | `utils/logger.py` | OK |
| `utils/secrets.ts` | `utils/secrets.py` | OK |
| `utils/jwt-secrets.ts` | `utils/jwt_secrets.py` | OK |
| `utils/webtoken.ts` | `utils/webtoken.py` | OK |
| `utils/s3.ts` | `utils/s3.py` | OK |
| Layer build script | `scripts/build_layer.py` | OK |
| `@RequirePermission` / `@RequireModule` | `auth_decorators.py` | OK |
| Express local | FastAPI `src/dev_server.py` | OK |
| `GET /health` | `GET /health` | OK |
| `X-Request-Id` / `ALLOWED_ORIGINS` | `request_context.py` | OK |
| Zod body validation | Pydantic `validation.py` | OK |
| Demo pagination | Demo pagination | OK |
| `modules/files` | `modules/files` | OK |
| `app-manifest.json` | `app-manifest.json` (kit root) | OK |

**Idiomatic note:** TypeScript uses `experimentalDecorators` + Inversify `@inject(TYPES.X)`. Python uses real decorators and constructor defaults `Inject(TYPES.X)`. CSR, cold-start cache, and JWT gates match. See `python-cloud-arc/docs/CSR-AND-DI.md` and `node-cloud-arc/docs/CSR-AND-DI.md`.
