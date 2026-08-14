# ArcForge Python — Changelog

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
