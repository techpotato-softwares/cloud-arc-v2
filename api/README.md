# ArcForge for Node — standalone CloudArc kit

TypeScript AWS serverless backend: shared Lambda layer, platform auth/RBAC,
demo CRUD module, AI stub, CDK, OpenAPI.

## Quick start

```bash
# from repo root
docker compose up -d
cp api/.env.example api/.env
cd api
npm install
npm run db:generate
npm run db:push          # or db:migrate
npm run db:seed:admin
npm run build:all
npm run dev:express      # http://localhost:4000
```

## Architecture

- **Shared layer** `layers/shared/nodejs` — decorators, router, Prisma, JWT, OpenAPI
- **Modules** `modules/platform`, `modules/demo`, `modules/ai`
- **CDK** `../cdk` — API Gateway + Lambda from `app-manifest.json`

## Auth

- `POST /api/login`, `POST /api/auth/refresh` (public)
- User create requires `@RequirePermission` (no open registration)
- Route guards: `@RequirePermission`, `@RequireModule`

See [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) and [../docs/PRICING.md](../docs/PRICING.md).
