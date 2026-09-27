# ForgeArc Node

Copy `forgearc-node` and you have a TypeScript serverless backend: Express on your machine, AWS CDK in the account, and the same handlers in both places.

The kit includes:

- Platform auth, users, roles, and permissions
- A demo CRUD module that shows the full controller → service → repository path
- S3 presigned upload and download
- An AI chat route that is still a stub
- Generated OpenAPI and a route manifest that CDK deploys

Persistence is Prisma against PostgreSQL. Dependency injection is Inversify. That is specific to this kit. The Python kit does not use either.

## Layout

```text
forgearc-node/
  api/                 Express dev server, modules, shared layer, Prisma
  infra/cdk/                 TypeScript CDK
  docker-compose.yml   PostgreSQL
  docs/                kit source notes
```

## Where to go

- [Getting started](./getting-started) — commands and what each one changes
- [Architecture](./architecture) — process, injection, and deploy
- [Modules](./modules) — routes and permissions
- [Shared request path](/architecture/request-path)
