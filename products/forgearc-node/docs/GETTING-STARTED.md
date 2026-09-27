# Getting started — ForgeArc Node

Copy the **`forgearc-node`** folder, then:

1. [ ] `cd` into your copied folder
2. [ ] `docker compose up -d`
3. [ ] `cp apps/api/.env.example apps/api/.env` (set `ALLOWED_ORIGINS` before production)
4. [ ] `cd apps/api && pnpm install`
5. [ ] `pnpm db:generate && pnpm db:push`
6. [ ] `pnpm db:seed:admin` (set `ADMIN_EMAIL` / `ADMIN_PASSWORD` if you want; seeds `files:read` / `files:write` too)
7. [ ] `pnpm build:all && pnpm dev:express`
8. [ ] `GET http://localhost:4000/health` then `POST /api/login` then `/api/demo/items?page=1&limit=20`
9. [ ] Optional: `POST /api/ai/chat`, `POST /api/files/presign` (needs S3 in AWS; local may stub/fail without credentials)
10. [ ] Configure `infra/cdk/` for **your** AWS account (no sample account IDs)
11. [ ] `cd infra/cdk && pnpm install && pnpm exec cdk deploy ApiStack-dev`
12. [ ] Restrict CORS + set production JWT secrets before go-live
13. [ ] Read [SECURITY.md](SECURITY.md), [API-CONTRACT.md](API-CONTRACT.md), [CSR-AND-DI.md](CSR-AND-DI.md)

Full architecture: [ARCHITECTURE.md](ARCHITECTURE.md)
