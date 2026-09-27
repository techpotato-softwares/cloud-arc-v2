# Buyer checklist — ForgeArc Python

1. [ ] Purchase license / receive private access
2. [ ] Clone or unzip **`forgearc-python`** (self-contained kit)
3. [ ] `cp apps/api/.env.example apps/api/.env` (`ALLOWED_ORIGINS` in prod)
4. [ ] `docker compose up -d`
5. [ ] `uv sync --all-packages --frozen`
6. [ ] `uv sync --all-packages --frozen`
7. [ ] Init DB (`uv run --package forgearc-python-api alembic -c migrations/alembic.ini upgrade head` or `init_db()`)
8. [ ] `uv run --package forgearc-python-api python apps/api/scripts/seed_admin.py`
9. [ ] `uv run --package forgearc-python-api uvicorn --app-dir apps/api src.dev_server:app --reload --port 4001`
10. [ ] `GET /health` + login + demo CRUD + `/api/ai/chat`
11. [ ] Build layer: `python layers/shared/python/scripts/build_layer.py`
12. [ ] Generate CDK routes + OpenAPI: `uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py && uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py`
13. [ ] Deploy: `cd ../cdk && uv sync --all-packages --frozen && bash infra/cdk/scripts/deploy.sh dev deploy`
14. [ ] Set `AI_PROVIDER` + keys only in Secrets Manager / env for prod
15. [ ] Read [SECURITY.md](SECURITY.md), [LAYER-PARITY.md](LAYER-PARITY.md), [CSR-AND-DI.md](CSR-AND-DI.md), [API-CONTRACT.md](API-CONTRACT.md)
