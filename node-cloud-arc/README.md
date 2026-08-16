# Node CloudArc (`node-cloud-arc`)

**Copy this entire folder** to start a new TypeScript / AWS serverless backend project.

You do **not** need `python-cloud-arc` or anything else from the monorepo.

## What’s inside

```text
node-cloud-arc/
├── README.md              ← you are here
├── docker-compose.yml     ← Postgres (+ Redis)
├── package.json           ← convenience scripts from this folder
├── docs/                  ← architecture, security, getting started
├── api/                   ← Lambda host, shared layer, modules
│   ├── layers/shared/nodejs/
│   ├── modules/{platform,demo,ai,files}/
│   ├── src/dev-server.ts  ← local API on :4000
│   └── .env.example
└── cdk/                   ← AWS CDK (API Gateway, Lambda, etc.)
```

## Start a new project

```bash
# 1. Copy the kit
cp -R node-cloud-arc ~/Projects/my-backend
cd ~/Projects/my-backend

# 2. Infra + env
docker compose up -d
cp api/.env.example api/.env
# edit api/.env if needed (defaults work with docker-compose)

# 3. Install & DB
cd api
npm install
npm run db:generate
npm run db:push
npm run db:seed:admin

# 4. Run local API
npm run dev:express
# → http://localhost:4000
```

Or from the kit root:

```bash
npm run install:api
npm run db:generate && npm run db:push && npm run db:seed
npm run dev
```

## Docs (read in order)

1. [docs/GETTING-STARTED.md](docs/GETTING-STARTED.md)
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
3. [docs/CSR-AND-DI.md](docs/CSR-AND-DI.md) — Controller → Service → Repository
4. [docs/API-CONTRACT.md](docs/API-CONTRACT.md)
5. [docs/SECURITY.md](docs/SECURITY.md)

Also: [api/README.md](api/README.md) · [docs/PRICING.md](docs/PRICING.md) · [LICENSE](LICENSE)

## Deploy

```bash
cd api && npm run build:all
cd ../cdk
# configure env (no hardcoded customer accounts)
npm install
npx cdk deploy ApiStack-dev
```

## Product

Sold as **ArcForge for Node**. Sibling kit: `../python-cloud-arc` (optional, separate purchase).
