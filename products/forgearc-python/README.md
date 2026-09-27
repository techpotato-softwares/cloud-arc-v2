# ForgeArc Python

An independently deliverable Python 3.12 AWS serverless backend using FastAPI
locally, Lambda/API Gateway in AWS, SQLAlchemy/SQLModel for persistence, and
Alembic for migrations. Prisma is not used.

```text
apps/api/           FastAPI host, tests, manifest and OpenAPI generators
packages/shared/    Router, DI, middleware, database, and Lambda layer builder
modules/            Platform, demo, AI, and files capabilities
migrations/         Alembic configuration and revisions
infra/cdk/          Python AWS CDK application
docs/               Product documentation
```

## Standalone setup

The official release ZIP contains its own `pyproject.toml` and `uv.lock`.

```bash
uv sync --all-packages --frozen
uv run --package forgearc-python-api pytest apps/api/tests
uv run --package forgearc-python-api uvicorn \
  --app-dir apps/api src.dev_server:app --reload --port 4001
```

## Generated contracts and layer

```bash
uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py
uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
uv run --package forgearc-python-api python packages/shared/scripts/build_layer.py
```

The layer builder exports the frozen uv dependency graph and installs
Linux/ARM64 site-packages into the deployment layer. uv is not required inside
Lambda.

## Database and deployment

```bash
uv run --package forgearc-python-api alembic -c migrations/alembic.ini upgrade head
bash infra/cdk/scripts/deploy.sh dev synth
bash infra/cdk/scripts/deploy.sh dev deploy
```

All supported Python commands run through uv.
