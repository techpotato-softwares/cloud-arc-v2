# ForgeArc Python setup

1. Accept the private repository invite sent to the license email.
2. Copy `forgearc-python` into a private repository that you control.
3. Start Postgres with `docker compose up -d`.
4. Copy `apps/api/.env.example` to `apps/api/.env`.
5. Run `uv sync --all-packages --frozen`.
6. Run `uv run --package forgearc-python-api alembic -c migrations/alembic.ini upgrade head`.
7. Seed with `uv run --package forgearc-python-api python apps/api/scripts/seed_admin.py`.
8. Start with `uv run --package forgearc-python-api uvicorn --app-dir apps/api src.dev_server:app --reload --port 4001`.
9. Confirm `http://localhost:4001/health` before deploying with `bash infra/cdk/scripts/deploy.sh dev deploy`.

Persistence stays on SQLAlchemy, SQLModel, and Alembic.
