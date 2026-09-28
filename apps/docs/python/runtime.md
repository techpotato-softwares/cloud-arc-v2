# ForgeArc Python runtime

## Request and dependency flow

FastAPI and Lambda use the same decorator registry, parameter resolver, controllers, services, and repositories. Lightweight constructor injection resolves explicit `Inject(TYPES.X)` bindings. SQLAlchemy sessions are supplied through `SESSION_FACTORY`; schema changes remain in Alembic.

<ArchitectureMap title="ForgeArc Python request path" preset="python-aws" />

## Database workflow

```bash
uv run --package forgearc-python-api alembic -c migrations/alembic.ini upgrade head
uv run --package forgearc-python-api python apps/api/scripts/seed_admin.py
```

Do not introduce Prisma or pip-managed requirement files. `pyproject.toml` and `uv.lock` govern every supported Python environment.

## Contracts and modules

Module registration is imported before `generate_manifest.py` and `generate_openapi.py` run. Add a package under `modules/`, declare controllers and permissions, register its Lambda handler, then regenerate both artifacts.

## Verify and deploy

```bash
uv run ruff check products/forgearc-python
uv run pytest products/forgearc-python/apps/api/tests
pnpm --dir products/forgearc-python synth:dev
```
