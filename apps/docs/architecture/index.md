# How the products fit together

ForgeArc sells three source products that share explicit application boundaries. Node, Python, and the AWS-first ForgeArc AI MVP are present in this repository.

| Product | Folder | Local runtime | Production | Data |
| --- | --- | --- | --- | --- |
| ForgeArc Node | `forgearc-node` | Express on port 4000 | TypeScript CDK, Node Lambdas | Prisma and PostgreSQL |
| ForgeArc Python | `forgearc-python` | FastAPI on port 4001 | Python CDK, Python Lambdas | SQLModel, SQLAlchemy, Alembic |
| ForgeArc AI | `products/forgearc-ai` | FastAPI on port 4020 | Python CDK, API and worker Lambdas | SQLAlchemy, Alembic, pgvector, AWS adapter |

<ArchitectureMap title="Python kit, local and AWS" preset="python-aws" />

<Mermaid chart="flowchart TB
  docs[Docs site] --> nodeKit[ForgeArc Node]
  docs --> pythonKit[ForgeArc Python]
  docs --> aiKit[ForgeArc AI AWS MVP]
  marketing[Marketing site] --> catalog[packages/commercial-catalog/catalog.yaml]
  catalog --> nodeKit
  catalog --> pythonKit
  catalog --> aiKit" />

## What is the same in Node and Python

- HTTP paths, JWT gates, and the JSON envelope `{ success, data | error }`.
- A module is a folder of controllers, services, and repositories.
- Decorators register routes. A build script writes `apps/api/app-manifest.json`. CDK reads that file and creates API Gateway routes.
- Public routes are `GET /health`, `POST /api/login`, and `POST /api/auth/refresh`.
- Every other route needs `Authorization: Bearer <accessToken>`, a permission, and sometimes a module flag on the tenant.

## What is different

The Node kit uses Prisma for the database and Inversify for dependency injection. The Python kit uses SQLAlchemy sessions and a small container in `core/di.py`. Schema changes in Python are Alembic revisions. Do not add Prisma to the Python kit.

## Read next

- [Request path](./request-path) — what happens between the HTTP call and the database
- [Modules](./modules) — platform, demo, files, and the current AI stub
- [Deploy](./deploy) — manifest, OpenAPI, shared layer, CDK
- [Security](./security) — what is enforced, and what you must set before production
- [Architecture layers](./layers) — conceptual boundaries shared across the products
