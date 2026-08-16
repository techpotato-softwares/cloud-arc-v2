# Buyer checklist — ArcForge Python

1. [ ] Purchase license / receive private access
2. [ ] Clone or unzip **`python-cloud-arc`** (self-contained kit)
3. [ ] `cp api/.env.example api/.env` (`ALLOWED_ORIGINS` in prod)
4. [ ] `docker compose up -d`
5. [ ] `cd api && python -m venv .venv && source .venv/bin/activate`
6. [ ] `pip install -e ".[dev]"`
7. [ ] Init DB (`alembic upgrade head` or `init_db()`)
8. [ ] `python scripts/seed_admin.py`
9. [ ] `uvicorn src.dev_server:app --reload --port 4001`
10. [ ] `GET /health` + login + demo CRUD + `/api/ai/chat`
11. [ ] Build layer: `python layers/shared/python/scripts/build_layer.py`
12. [ ] Generate CDK routes + OpenAPI: `python scripts/generate_manifest.py && python scripts/generate_openapi.py`
13. [ ] Deploy: `cd ../cdk && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cdk deploy ApiStack-dev`
14. [ ] Set `AI_PROVIDER` + keys only in Secrets Manager / env for prod
15. [ ] Read [SECURITY.md](SECURITY.md), [LAYER-PARITY.md](LAYER-PARITY.md), [CSR-AND-DI.md](CSR-AND-DI.md), [API-CONTRACT.md](API-CONTRACT.md)
