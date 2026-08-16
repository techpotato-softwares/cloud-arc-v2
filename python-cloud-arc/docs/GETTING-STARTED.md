# Getting started — Python CloudArc

Copy the **`python-cloud-arc`** folder, then:

1. [ ] `cd` into your copied folder
2. [ ] `docker compose up -d`
3. [ ] `cp api/.env.example api/.env` (set `ALLOWED_ORIGINS` before production)
4. [ ] `cd api && python3 -m venv .venv && source .venv/bin/activate`
5. [ ] `pip install -e ".[dev]"`
6. [ ] Init DB: `alembic upgrade head` (kit: `npm run db:migrate`) or `init_db()` as in the kit README
7. [ ] `python scripts/seed_admin.py` (kit: `npm run db:seed:admin`)
8. [ ] `uvicorn src.dev_server:app --reload --port 4001`
9. [ ] `GET http://localhost:4001/health` then login + `GET /api/demo/items?page=1&limit=20` + `POST /api/ai/chat`
10. [ ] `python layers/shared/python/scripts/build_layer.py`
11. [ ] `python scripts/generate_manifest.py && python scripts/generate_openapi.py`
12. [ ] `cd ../cdk && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cdk deploy ApiStack-dev`
13. [ ] Set `AI_PROVIDER` + keys only via env / Secrets Manager in prod
14. [ ] New SKU: `python scripts/scaffold_module.py <sku>` then add it to `dev_server.py` and the catalog
15. [ ] Read [SECURITY.md](SECURITY.md), [LAYER-PARITY.md](LAYER-PARITY.md), [CSR-AND-DI.md](CSR-AND-DI.md), [API-CONTRACT.md](API-CONTRACT.md)

Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
