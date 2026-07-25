# ArcForge

**The same CloudArc architecture. Pick TypeScript or Python.**

ArcForge is a commercial AWS serverless backend boilerplate sold as **two separate products**:

| Product | Path | Best for |
|---------|------|----------|
| **ArcForge for Node** | [`api/`](api/) | TypeScript teams, Lambda agencies |
| **ArcForge for Python** | [`python/`](python/) | AI / FastAPI / data teams |

Optional **Bundle** includes both trees and a shared API contract.

## Feature highlights

- Shared **Lambda layer** (decorators, router, DI/handler factory, JWT, secrets, S3, OpenAPI)
- **Platform** auth + RBAC (`@RequirePermission`, `@RequireModule`)
- Soft **multi-tenancy** (`Tenant.modules_enabled`)
- **Demo** CRUD module as the buyer tutorial
- **AI** starter (richer providers on Python)
- CDK + local DX (Express / FastAPI)
- Tests + GitHub Actions per language

## Quick start

```bash
docker compose up -d

# Node
cp api/.env.example api/.env
cd api && npm install && npm run db:generate && npm run db:push && npm run dev:express

# Python (separate terminal)
cd python && python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && cp .env.example .env
uvicorn src.dev_server:app --reload --port 4001
```

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design |
| [docs/LAYER-PARITY.md](docs/LAYER-PARITY.md) | Node ↔ Python shared-layer checklist |
| [docs/SECURITY.md](docs/SECURITY.md) | Auth, secrets, known gaps |
| [docs/API-CONTRACT.md](docs/API-CONTRACT.md) | Shared routes |
| [docs/SELLING.md](docs/SELLING.md) | Whom to sell & channels |
| [docs/PRICING.md](docs/PRICING.md) | SKU pricing & business model |
| [docs/ROADMAP-CLOUD-AGNOSTIC.md](docs/ROADMAP-CLOUD-AGNOSTIC.md) | Multi-cloud plan |
| [docs/ROADMAP-AI.md](docs/ROADMAP-AI.md) | AI feasibility roadmap |
| [docs/BUYER-CHECKLIST-NODE.md](docs/BUYER-CHECKLIST-NODE.md) | Node go-live |
| [docs/BUYER-CHECKLIST-PYTHON.md](docs/BUYER-CHECKLIST-PYTHON.md) | Python go-live |

## Pricing (summary)

| SKU | USD |
|-----|-----|
| ArcForge Node | $349 |
| ArcForge Python | $399 |
| Bundle | $599 |
| Agency | $1,499 |
| Enterprise | $4,000+ |

Details: [docs/PRICING.md](docs/PRICING.md).

## Honest gap flags (v1)

- No WAF / API rate limiting yet
- No Cognito / OAuth / MFA (JWT Bearer only)
- Cloud-agnostic adapters are **design-only** (AWS first)
- AI module is a **starter**, not a full RAG product
- Frontend MFEs are not included in the sold backend kits

## License

Commercial — see [LICENSE](LICENSE).
