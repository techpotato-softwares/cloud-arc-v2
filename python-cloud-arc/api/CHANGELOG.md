# ArcForge Python — Changelog

## 1.0.3 — 2026-08-16

- User / role / permission HTTP APIs (same paths as Node)
- Pydantic `@ApiBody` validation, `GET /health`, `X-Request-Id`, `ALLOWED_ORIGINS`
- Paginated demo + RBAC lists; files SKU; `scripts/seed_admin.py`; Alembic initial revision
- `scripts/scaffold_module.py`; Python CI (ruff + pytest)

## 1.0.2 — 2026-08-16

- Controller → Service → Repository with constructor injection (`Inject(TYPES.X)`), matching Node Inversify
- `define_lambda(..., bindings=[...])` now wires a real DI container (session factory + services + repos)
- Docs: `docs/CSR-AND-DI.md`, `api/layers/shared/DI.md`, module READMEs

## 1.0.1 — 2026-08-14

- Auto-generate `app-manifest.json` from `@Controller` routes (`scripts/generate_manifest.py`)
- Emit OpenAPI 3.1 from Pydantic `@ApiBody` schemas (`scripts/generate_openapi.py`)
- `npm run build:manifest` / `build:openapi` / `build:all`; CDK deploy runs both generators

## 1.0.0 — 2026-07-23

- Initial sellable Python CloudArc kit
- Shared layer mirror of Node (`config`, `database`, `decorators`, `core`, `middleware`, `utils`)
- Platform auth, demo CRUD, AI provider interface (stub / OpenAI / Bedrock)
- FastAPI local server + Mangum-ready handlers
- pytest + GitHub Actions
- Alembic scaffolding + layer build script
