# Deploy ForgeArc AI on GCP

The GCP edition uses the same chat, document, and job interfaces as AWS. `packages/gcp_adapter` is the only package that imports the Google Cloud client libraries.

<ArchitectureMap title="ForgeArc AI on GCP" preset="ai-gcp" />

No provider block is required. Terraform sets `FORGEARC_AI_CLOUD=gcp` and
injects the project, location, bucket, Pub/Sub topic, Firestore database, and
secret identifier into both Cloud Run services. The GCP preset selects Vertex
AI, Cloud Storage, and Pub/Sub automatically.

## Terraform

```bash
cd products/forgearc-ai/infra/terraform
terraform init -backend=false
terraform validate
```

Apply with a project id and container image. The stack enables Vertex AI, creates a private Cloud Storage bucket, a Pub/Sub topic with a dead-letter topic, a Firestore database for job status, Secret Manager, Cloud Run services for the API and worker, and AlloyDB for pgvector. Set `enable_alloydb = false` when you want the storage and queue path without the database.

Pub/Sub requires at least five delivery attempts before a message can enter the dead-letter topic. The worker still marks a job dead after the three attempts configured in `limits.job_attempts`.

The push subscription posts an authenticated OIDC request to
`/internal/pubsub`. The message contains enough tenant and document metadata
for a separate worker instance to restore the job and load its source from
Cloud Storage; it does not depend on API-process memory.

## What each product does

| GCP product | Role in the kit |
| --- | --- |
| Cloud Run | API and ingestion worker |
| Vertex AI | Chat model and embeddings. The service account has `roles/aiplatform.user` |
| Cloud Storage | Original documents. Public access is blocked |
| Pub/Sub | Ingestion jobs and the dead-letter topic |
| Firestore | Job status recorded when a job is published |
| AlloyDB | Tenant data and pgvector retrieval, the same role as RDS |
| Secret Manager | Provider credentials and the generated database password |
