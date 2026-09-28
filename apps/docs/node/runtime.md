# ForgeArc Node runtime

## Request lifecycle

1. Express locally or API Gateway on AWS receives the request.
2. The generated manifest selects the module Lambda and route.
3. JWT, module, permission, validation, and parameter middleware run.
4. The controller calls a service; the service calls a repository.
5. Prisma owns database access and migrations.
6. The response uses the shared success or error envelope.

<ArchitectureMap title="ForgeArc Node request path" preset="node-aws" />

## Generated contracts

`pnpm --filter @forgearc/api-host build:manifest` imports module registrations and writes `apps/api/app-manifest.json`. `build:openapi` writes the OpenAPI JSON and YAML used by client teams and deployment checks.

## Extend it

Create a module under `modules/`, register controllers and Lambdas, add its package to the workspace, then regenerate the manifest. Keep business rules in services and persistence in repositories so local and Lambda entrypoints call the same code.

## Test and deploy

```bash
pnpm --dir products/forgearc-node typecheck
pnpm --dir products/forgearc-node test --runInBand
pnpm --dir products/forgearc-node synth
```

Never commit `.env` files or CDK output. Production secrets belong in AWS Secrets Manager.
