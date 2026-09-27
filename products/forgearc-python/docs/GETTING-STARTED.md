# Getting started

From the standalone ForgeArc Python product root:

1. Run `docker compose up -d`.
2. Copy `apps/api/.env.example` to `apps/api/.env`.
3. Run `uv sync --all-packages --frozen`.
4. Run `uv run --package forgearc-python-api alembic -c migrations/alembic.ini upgrade head`.
5. Seed with `uv run --package forgearc-python-api python apps/api/scripts/seed_admin.py`.
6. Start FastAPI with `uv run --package forgearc-python-api uvicorn --app-dir apps/api src.dev_server:app --reload --port 4001`.
7. Verify `/health`, log in, and test the demo, AI, and file routes.
8. Regenerate contracts and the layer with the `uv run --package forgearc-python-api python ...` commands in the product README.
9. Deploy with `bash infra/cdk/scripts/deploy.sh dev deploy`.

Keep provider keys and production database credentials in environment variables
or AWS Secrets Manager.
