# ArcForge for Python

Standalone AWS serverless CloudArc kit — **shared layer parity** with ArcForge Node,
FastAPI local DX, SQLModel/Alembic, platform + demo + **AI providers**.

## Quick start

```bash
docker compose up -d
cd python
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
# create tables
python -c "import os,sys; os.environ['IS_LOCAL']='true'; sys.path.insert(0,'layers/shared/python/src'); from database import init_db; from database import models; init_db()"
uvicorn src.dev_server:app --reload --port 4001
```

## Shared layer layout (mirrors Node)

```
layers/shared/python/src/
  config/ database/ decorators/ core/ middleware/ utils/
```

| Node | Python |
|------|--------|
| handler-factory | `core/handler_factory.py` |
| router | `core/router.py` |
| defineLambda | `core/service_registry.py` |
| @RequirePermission | `decorators/auth_decorators.py` |
| Prisma | SQLModel + `database/models.py` |

## Modules

- `modules/platform` — login / refresh
- `modules/demo` — `/api/demo/items` CRUD
- `modules/ai` — `/api/ai/chat` with stub / OpenAI / Bedrock providers

## Tests

```bash
pytest
```

See [../docs/LAYER-PARITY.md](../docs/LAYER-PARITY.md) and [../docs/PRICING.md](../docs/PRICING.md).
