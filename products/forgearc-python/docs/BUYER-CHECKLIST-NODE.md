# Buyer checklist — ForgeArc Node

1. [ ] Purchase license / receive private access
2. [ ] Clone or unzip the Node tree (`apps/api/` + `infra/cdk/` + `docs/`)
3. [ ] Copy `apps/api/.env.example` → `apps/api/.env` and set secrets (`ALLOWED_ORIGINS` in prod)
4. [ ] `docker compose up -d` (Postgres)
5. [ ] `cd apps/api && pnpm install && pnpm db:generate && pnpm db:push`
6. [ ] Seed admin (`pnpm db:seed:admin`) — set `ADMIN_EMAIL` / `ADMIN_PASSWORD`
7. [ ] `pnpm build:all && pnpm dev:express`
8. [ ] `GET /health`; login via `POST /api/login`; exercise `/api/demo/items`
9. [ ] Configure CDK env hosts/secrets for your AWS account (no sample account IDs)
10. [ ] Deploy `ApiStack-dev`; smoke-test API Gateway URL including `/health`
11. [ ] Restrict CORS and set production JWT secrets in Secrets Manager
12. [ ] Read [SECURITY.md](SECURITY.md) and [API-CONTRACT.md](API-CONTRACT.md) before go-live
