# Buyer checklist — ArcForge Python

1. [ ] Purchase license / receive private access
2. [ ] Clone or unzip the Python tree (`python/` + shared `docs/`)
3. [ ] Copy `python/.env.example` → `python/.env`
4. [ ] `docker compose up -d`
5. [ ] `cd python && python -m venv .venv && source .venv/bin/activate`
6. [ ] `pip install -e ".[dev]"`
7. [ ] Init DB (`init_db()` or Alembic)
8. [ ] `uvicorn src.dev_server:app --reload --port 4001`
9. [ ] Login + demo CRUD + `/api/ai/chat`
10. [ ] Build layer: `python layers/shared/python/scripts/build_layer.py`
11. [ ] Wire CDK `PythonFunction` using `app-manifest.json`
12. [ ] Set `AI_PROVIDER` + keys only in Secrets Manager / env for prod
13. [ ] Read [SECURITY.md](SECURITY.md) and [LAYER-PARITY.md](LAYER-PARITY.md)
