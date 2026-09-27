# ForgeArc Node

An independently deliverable Node 20 serverless backend using TypeScript,
Express locally, Lambda/API Gateway in AWS, Prisma, PostgreSQL, and AWS CDK.

```text
apps/api/           API host, tests, manifest and OpenAPI generators
packages/shared/    Router, DI, Prisma client, and Lambda layer
modules/            Platform, demo, AI, and files capabilities
infra/cdk/          TypeScript AWS CDK application
docs/               Product documentation
```

## Standalone setup

The official release ZIP contains its own pnpm workspace and lock.

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm typecheck
pnpm test --runInBand
pnpm dev
```

## Build and deploy

```bash
pnpm build
pnpm synth
pnpm --filter @forgearc/cdk deploy:dev
```

`pnpm build` assembles the shared Lambda layer, compiles every module Lambda,
and regenerates the app manifest and OpenAPI contract.
