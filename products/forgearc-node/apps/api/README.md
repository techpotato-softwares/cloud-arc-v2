# ForgeArc for Node — API host

TypeScript AWS serverless backend inside the **forgearc-node** kit.

## Quick start (from kit root)

```bash
cd ..   # forgearc-node/
docker compose up -d
cp apps/api/.env.example apps/api/.env
cd apps/api
pnpm install
pnpm db:generate
pnpm db:push
pnpm db:seed:admin
pnpm build:all
pnpm dev:express   # http://localhost:4000
```

## Layout

- **Shared layer** `layers/shared/nodejs` — decorators, router, Prisma, JWT, OpenAPI
- **Modules** `modules/platform`, `modules/demo`, `modules/ai`, `modules/files`
- **CDK** `../cdk` — API Gateway + Lambda from `app-manifest.json`

## Auth

- `POST /api/login`, `POST /api/auth/refresh`, `GET /health` (public)
- Users / roles / permissions: `/api/user`, `/api/role`, `/api/permission`
- Route guards: `@RequirePermission`, `@RequireModule`

Kit docs: [../docs/GETTING-STARTED.md](../docs/GETTING-STARTED.md) · [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) · [../docs/CSR-AND-DI.md](../docs/CSR-AND-DI.md)
