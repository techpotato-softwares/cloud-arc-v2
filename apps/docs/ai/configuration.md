# ForgeArc AI configuration

`products/forgearc-ai/forgearc-ai.yaml` is the typed source of truth. For the
standard editions, select one cloud instead of repeating every provider:

```yaml
environment: local
cloud: local
```

The infrastructure sets `cloud: aws` or `cloud: gcp` automatically at runtime.
That selection supplies the standard model, embedding model, document store,
and job queue:

| Cloud | Model | Documents | Jobs |
| --- | --- | --- | --- |
| `local` | OpenAI | Memory | Inline |
| `aws` | Bedrock | S3 | SQS |
| `gcp` | Vertex AI | Cloud Storage | Pub/Sub |

AWS CDK injects its bucket, queue, region, and secret identifiers. Choose
`runtime=lambda` or `runtime=fargate` at synth time. GCP Terraform injects its
project, location, bucket, topic, Firestore database, and secret identifiers.
Choose `runtime_mode=serverless` or `runtime_mode=always_on` at apply time.
Users do not copy those generated values into YAML. Both modes still require
`DATABASE_URL`.

## Optional overrides

Advanced users can still set `chat`, `embeddings`, `documents_provider`, and
`jobs_provider` explicitly. Explicit values override the cloud preset. Model
names must appear in their allowlists. Pin `jev.model` to a concrete version
such as `jev-1.13.0`.

Production rejects fake providers, local users, missing JWT or OIDC settings, a missing `DATABASE_URL`, and moving Jev aliases such as `jev-latest`.

## Why ForgeArc AI needs durable state

Jobs, vectors, conversations, usage, agent runs, approvals, and evaluations must survive a new process. `MemoryRepository` holds them in one Python process, so a reviewer who hits another Lambda or container after an approval pause gets `Approval not found.` Always-on Fargate or Cloud Run does not keep that memory across deploys and scale-out.

Set `DATABASE_URL` to PostgreSQL with pgvector. That selects `PostgresRepository` for Aurora and for AlloyDB. Leave it empty only for local and test, which use `MemoryRepository`. Production startup exits without the URL. The decision record is [Durable state](./durable-state). Runtime choice is separate and is documented in [Production runtimes](./production).

```yaml
environment: prod
cloud: aws
database_url: ${DATABASE_URL}
auth:
  mode: oidc
  issuer: https://cognito-idp.REGION.amazonaws.com/POOL_ID
  audience: APP_CLIENT_ID
  jwks_url: https://cognito-idp.REGION.amazonaws.com/POOL_ID/.well-known/jwks.json
```

`auth.mode` is `local` or `oidc`. `local` is HMAC and `local_users`, and production startup fails with `Production authentication must use OIDC.` `oidc` is Cognito on AWS and Identity Platform on GCP. Default claims are `custom:tenant_id`, `permissions`, and `modules`. The app checks issuer, audience, expiry, tenant, module, and permission on every request.

Managed runtimes inject the OIDC settings as `FORGEARC_AI_AUTH_MODE`, `FORGEARC_AI_OIDC_ISSUER`, `FORGEARC_AI_OIDC_AUDIENCE`, and `FORGEARC_AI_OIDC_JWKS_URL`. Claim names can be mapped with `FORGEARC_AI_OIDC_TENANT_CLAIM`, `FORGEARC_AI_OIDC_PERMISSIONS_CLAIM`, `FORGEARC_AI_OIDC_MODULES_CLAIM`, and `FORGEARC_AI_OIDC_GROUPS_CLAIM`; `FORGEARC_AI_OIDC_DEFAULT_MODULES` is a comma-separated fallback. Set `FORGEARC_AI_CORS_ORIGINS` to an explicit origin list. A `*` origin fails production startup. GCP uses the Identity Platform issuer and JWKS URL in those same variables.

## Application cache

Optional read-through helpers live in `forgearc_ai.cache` and share the platform `FORGEARC_CACHE_*` settings (TTL, jitter, stampede mutex, negative/error caching). Defaults require a positive TTL, invalidate on write, coalesce concurrent misses, and do not cache errors. See [Caching in ForgeArc AI](./caching) and [Caching patterns](/architecture/caching). Do not use this cache for agent runs, approvals, or vectors — those stay in PostgreSQL.

## Controls

`limits` caps prompt size, request rate, and ingestion attempts. `budget.monthly_usd` blocks model calls once exhausted. `moderation_terms` and `tool_allowlist` provide deterministic application gates before any provider call.

`agents` and `evaluation` have working defaults. See [Agents, approvals, and evaluation](./agents) to change profiles, approval tools, or score thresholds.

## Secrets

Environment variables supply secrets and deployment-generated resource names;
they do not require a second YAML file. Local values come from `.env`. AWS
values live in Secrets Manager and Bedrock uses IAM. GCP values live in Secret
Manager and Vertex AI uses the Cloud Run service account.

## Adapter contract

The core defines `ModelProvider`, `DocumentStore`, and `JobQueue` protocols.
AWS and GCP implement these contracts. Core services call the protocols and
never import a cloud SDK, which keeps application code unchanged when the cloud
selection changes.
