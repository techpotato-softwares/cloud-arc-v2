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
- **Modules** `modules/platform`, `modules/demo`, `modules/ai`, `modules/files` — each has `controllers/`, `services/`, and (where needed) `repositories/` plus `lambdas/`
- **Scheduled** `src/lambdas/` — e.g. RDS start/stop scheduler
- **CDK** `../cdk` — Python CDK (`aws-cdk-lib`) wires API Gateway + Lambda from generated `app-manifest.json`

## Build artifacts

```bash
python scripts/generate_manifest.py   # api/app-manifest.json from @Controller routes
python scripts/generate_openapi.py    # api/openapi/openapi.{json,yaml} from Pydantic + routes
```

Or from the kit root: `npm run build:manifest` / `npm run build:openapi` / `npm run build:all`.

New controllers or routes are picked up automatically when you re-run those scripts (import via `modules/*/lambdas/*.py`). Attach request schemas with `@ApiBody(MyModel)` so they appear in OpenAPI.

## CSR + DI (same as Node)

Full reference: **[docs/CSR-AND-DI.md](../docs/CSR-AND-DI.md)** · container lifecycle: **[layers/shared/DI.md](layers/shared/DI.md)**

```text
Lambda  →  Controller  →  Service  →  Repository  →  SQLModel session
```

Constructor injection uses `Inject(TYPES.X)` (Node: `@inject(TYPES.X)`). Wire them in the lambda file:

```python
define_lambda(
    name="demo",
    controllers=[DemoItemController],
    bindings=[
        {"symbol": TYPES.DemoItemService, "implementation": DemoItemService},
        {"symbol": TYPES.DemoItemRepository, "implementation": DemoItemRepository},
    ],
)
```

## Auth

- `POST /api/login`, `POST /api/auth/refresh`, `GET /health` (public)
- Users / roles / permissions: `/api/user`, `/api/role`, `/api/permission`
- Route guards: `@RequirePermission`, `@RequireModule`

Init + seed: `alembic upgrade head` then `python scripts/seed_admin.py`. New module: `python scripts/scaffold_module.py <sku>`.

## Deploy layer

```bash
python layers/shared/python/scripts/build_layer.py
# → layers/shared/python/bundled/python  (Lambda /opt/python)
```

Kit docs: [../docs/GETTING-STARTED.md](../docs/GETTING-STARTED.md) · [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) · [../docs/CSR-AND-DI.md](../docs/CSR-AND-DI.md)
