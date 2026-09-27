# Deploy

CDK does not scan your source at synth time. It reads `apps/api/app-manifest.json`, which a build script writes from the route decorators. If you add a route and skip that script, API Gateway will not expose it.

<Mermaid chart="flowchart LR
  decorators[Route decorators] --> manifest[app-manifest.json]
  schemas[Zod or Pydantic schemas] --> openapi[openapi.yaml]
  manifest --> cdk[CDK ApiStack]
  layer[Shared layer zip] --> cdk
  cdk --> apigw[API Gateway]
  cdk --> lambdas[One Lambda per handler]
  cdk --> secrets[JWT secret]
  cdk --> s3[S3 when enabled]" />

## What the stack creates

From `infra/cdk/stacks` in each kit:

- A shared Lambda layer with config, database helpers, router, JWT, and middleware. Product modules stay in the function zip, not the layer.
- One function per handler name in the manifest. Platform is four functions: `auth`, `user`, `role`, `permission`. Demo, AI, and files are one function each.
- API Gateway routes copied from the manifest.
- A Secrets Manager secret for JWT signing.
- An S3 bucket when `features.s3` is true. Dev defaults enable S3.
- RDS only when `features.rds` is true. Dev defaults leave RDS off so you can point the stack at a database you already have.

Dev Lambda settings are 256 MB and 30 seconds. That is enough for the current kits. It is too short for a long model call, which is why ForgeArc AI moves heavy work onto a queue.

## Commands

Node, from `forgearc-node`:

```bash
pnpm build:all --prefix api
cd infra/cdk && pnpm exec cdk deploy ApiStack-dev
```

Python, from `forgearc-python`:

```bash
cd apps/api
python layers/shared/python/scripts/build_layer.py
uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py
uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
cd ../cdk && cdk deploy ApiStack-dev
```

`infra/cdk/scripts/deploy.sh` runs the same Python sequence.

## Environments

`dev`, `qa`, and `prod` are separate stacks (`ApiStack-dev` and so on). Each has its own secret ids, log retention, and feature flags. Set `APP_NAME` before synth if the secret path should not use the default `forgearc` prefix.

## After deploy

1. Set `ALLOWED_ORIGINS` to your real site origin. The default `*` is for local use.
2. Confirm `JWT_SECRET_ID` and the database secret are the ones CDK created, not values from `.env.example`.
3. Run migrations against that database, then seed the admin user.
4. Call `GET /health`, then `POST /api/login`, then one authenticated route.
