# ForgeArc Python

Copy `forgearc-python` and you have a Python serverless backend: FastAPI on your machine, Python CDK in AWS, and the same handlers in both places.

Persistence is SQLModel and SQLAlchemy. Schema changes are Alembic revisions. There is no Prisma client, schema, or migrate command in this kit.

The kit includes:

- Platform auth, users, roles, permissions, and `GET /health`
- Demo CRUD with tenant-scoped, paginated lists
- S3 presigned upload and download
- An AI chat route that is still a stub
- Generated OpenAPI and `app-manifest.json` for CDK

## Layout

```text
forgearc-python/
  api/
    src/dev_server.py
    modules/{platform,demo,ai,files}/
    packages/shared/src/     router, DI, SQLAlchemy, JWT
    alembic/
  infra/cdk/                            Python CDK
  docker-compose.yml              PostgreSQL with pgvector, plus Redis
```

Redis is in Compose for later rate limits. The current API does not connect to it.

## Where to go

- [Getting started](./getting-started)
- [Architecture](./architecture)
- [Modules and data](./modules)
- [Shared request path](/architecture/request-path)
