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

AWS CDK injects its bucket, queue, region, and secret identifiers. GCP
Terraform injects its project, location, bucket, topic, Firestore database, and
secret identifiers. Users do not copy those generated values into YAML.

## Optional overrides

Advanced users can still set `chat`, `embeddings`, `documents_provider`, and
`jobs_provider` explicitly. Explicit values override the cloud preset. Model
names must appear in their allowlists. Pin `jev.model` to a concrete version
such as `jev-1.13.0`.

Production rejects fake providers, local users, missing JWT/provider credentials, and moving Jev aliases such as `jev-latest`.

## Controls

`limits` caps prompt size, request rate, and ingestion attempts. `budget.monthly_usd` blocks model calls once exhausted. `moderation_terms` and `tool_allowlist` provide deterministic application gates before any provider call.

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
