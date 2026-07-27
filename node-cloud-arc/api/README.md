# ArcForge for Node — API host

TypeScript AWS serverless backend inside the **node-cloud-arc** kit.

## Quick start (from kit root)

```bash
cd ..   # node-cloud-arc/
docker compose up -d
cp api/.env.example api/.env
cd api
npm install
npm run db:generate
npm run db:push
npm run db:seed:admin
npm run build:all
npm run dev:express   # http://localhost:4000
```

## Layout

- **Shared layer** `layers/shared/nodejs` — decorators, router, Prisma, JWT, OpenAPI
- **Modules** `modules/platform`, `modules/demo`, `modules/ai`
- **CDK** `../cdk` — API Gateway + Lambda from `app-manifest.json`

## Auth

- `POST /api/login`, `POST /api/auth/refresh` (public)
- User create requires `@RequirePermission`
- Route guards: `@RequirePermission`, `@RequireModule`

Kit docs: [../docs/GETTING-STARTED.md](../docs/GETTING-STARTED.md) · [../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
