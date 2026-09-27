# Node architecture

<ArchitectureMap title="ForgeArc Node" preset="node-aws" />

## Processes

| Process | Where | Role |
| --- | --- | --- |
| Express | `apps/api/src/dev-server.ts`, port 4000 | Turns an HTTP request into the Lambda event shape |
| Module Lambda | `modules/*/lambdas/*.lambda.ts` | One deployed function per handler name |
| Shared layer | `packages/shared` | Router, JWT, errors, Prisma client wiring, OpenAPI helpers |
| CDK | `infra/cdk/` | Reads `apps/api/app-manifest.json` and builds API Gateway, Lambdas, secrets, and optional S3 |

Express is not deployed. It exists so you do not need API Gateway to test a route.

## Inside a request

<Mermaid chart="flowchart TB
  express[Express or API Gateway] --> handler[Module handler]
  handler --> container[Inversify container cached on cold start]
  container --> router[Router]
  router --> jwt[JWT unless the route is public]
  jwt --> perm[RequirePermission and RequireModule]
  perm --> zod[Zod body]
  zod --> controller[Controller]
  controller --> service[Service]
  service --> repo[Repository]
  repo --> prisma[Prisma client]
  prisma --> pg[(PostgreSQL)]" />

`defineLambda({ name, controllers, bindings })` registers the controllers for that function. Constructors take `@inject(TYPES.Foo)`. The Prisma client is the database binding, the same role `SESSION_FACTORY` plays in the Python kit.

## A module on disk

```text
modules/demo/
  lambdas/demo.lambda.ts
  src/controllers/DemoController.ts
  src/services/
  src/repositories/
  src/schemas/          Zod request models
  src/types/svc.types.ts
```

Platform is split into four Lambdas (`auth`, `user`, `role`, `permission`) because login must stay small and public while user administration stays behind permissions.

## Deploy shape

Route decorators are the source of truth. `pnpm build:manifest` scans them and writes `apps/api/app-manifest.json`. CDK creates one API Gateway method per entry and points it at the handler string in that file. `pnpm build:openapi` writes `apps/api/openapi/` from the Zod schemas.

See [Deploy](/architecture/deploy) for flags, secret ids, and the post-deploy checklist.
