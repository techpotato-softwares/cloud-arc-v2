# ArcForge for Python — API host

Python AWS serverless backend inside the **python-cloud-arc** kit.

## Quick start (from kit root)

```bash
cd ..   # python-cloud-arc/
docker compose up -d
cp api/.env.example api/.env
cd api
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.dev_server:app --reload --port 4001
# → http://localhost:4001
```

## Layout

- **Shared layer** `layers/shared/python` — decorators, router, SQLModel, JWT, middleware
- **Modules** `modules/platform`, `modules/demo`, `modules/ai` (entrypoints in `lambdas/`)
- **Scheduled** `src/lambdas/` — e.g. RDS start/stop scheduler
- **CDK** `../cdk` — Python CDK (`aws-cdk-lib`) wires API Gateway + Lambda from `app-manifest.json`


## Auth

- `POST /api/login`, `POST /api/auth/refresh` (public)
- Route guards: `@require_permission`, `@require_module`

## Deploy layer

```bash
python layers/shared/python/scripts/build_layer.py
# → layers/shared/python/bundled/python  (Lambda /opt/python)
```

Kit docs: [../docs/GETTING-STARTED.md](../docs/GETTING-STARTED.md) · [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
