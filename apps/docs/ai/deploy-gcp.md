# Deploy ForgeArc AI on GCP

The GCP edition uses the same chat, document, job, agent, and approval interfaces as AWS. `packages/gcp_adapter` is the only package that imports the Google Cloud client libraries.

Cloud Run has two modes. `runtime_mode=serverless` sets `min_instance_count = 0` and scales to zero. `runtime_mode=always_on` keeps minimum instances with CPU always allocated, which is the continuously running counterpart to Fargate. Both modes require AlloyDB with pgvector when `environment` is `prod`. Always-on instances still lose process memory on deploy, crash, and scale-out. Read [Why ForgeArc AI needs durable state](./durable-state) and [Production runtimes](./production).

<ArchitectureMap title="ForgeArc AI on GCP" preset="ai-gcp" />

No provider block is required. Terraform sets `FORGEARC_AI_CLOUD=gcp` and injects the project, location, bucket, Pub/Sub topic, Firestore database, and secret identifier into both Cloud Run services. The application reads `DATABASE_URL` from Secret Manager. The GCP preset selects Vertex AI, Cloud Storage, and Pub/Sub automatically.

## Terraform

```bash
cd products/forgearc-ai/infra/terraform
terraform init -backend=false
terraform validate
terraform apply \
  -var project_id=YOUR_PROJECT \
  -var environment=prod \
  -var runtime_mode=serverless \
  -var container_image=REGION-docker.pkg.dev/YOUR_PROJECT/forgearc/api:1.0.0
```

Use `-var runtime_mode=always_on` when cold starts are not acceptable. Set `min_instance_count`, `max_instance_count`, request concurrency, CPU allocation, and health probes for the API and the worker in that same apply. Serverless keeps the minimum at zero. Always-on sets a minimum of at least one and allocates CPU between requests.

`environment=prod` requires AlloyDB. The database is reached over Direct VPC egress. `enable_alloydb=false` is only a storage-and-queue preview for a non-production environment. Production validation rejects a missing `DATABASE_URL`.

The stack enables Vertex AI, creates a private Cloud Storage bucket, a Pub/Sub topic with a dead-letter topic, a Firestore database for job status, Secret Manager, Cloud Run services for the API and worker, AlloyDB for pgvector, a Cloud Run Job for migrations, and Identity Platform. CMEK can cover Storage, Pub/Sub, and Secret Manager. Cloud Monitoring alerts cover dead-letter messages, 5xx, latency, instance count, and database connections.

Pub/Sub requires at least five delivery attempts before a message can enter the dead-letter topic. The worker still marks a job dead after the three attempts configured in `limits.job_attempts`.

The push subscription posts an authenticated OIDC request to `/internal/pubsub`. The message contains enough tenant and document metadata for a separate worker instance to restore the job and load its source from Cloud Storage. It does not depend on API-process memory. Worker ingress is internal. Only the Pub/Sub identity has `run.invoker` on the worker service.

Identity Platform uses the same claim mapping as Cognito: tenant, permissions, and module. The application verifies the token against the JWKS URL on every request and checks issuer, audience, expiry, tenant, module, and permission again. Local HMAC users are rejected in production.

Assign the `tenant_id`, `permissions`, `modules`, and optional `groups` custom claims from a trusted administrative backend when users are provisioned. Terraform enables the project-level identity provider but intentionally does not assign per-user authorization claims.

Firestore still stores job status when a job is published. Approvals, agent runs, chunks, and the cost ledger are in AlloyDB.

## Migrations

API revisions do not run Alembic on startup. Before the new revision receives traffic:

1. Deploy the Cloud Run Job that uses the new image digest and the `DATABASE_URL` secret.
2. Execute that job and wait until it succeeds.
3. Roll the API and worker services to the same digest.

A failed job blocks the rollout.

## Rollback

Route traffic back to the previous Cloud Run revision. Leave the bad revision in place until the database question is settled.

Run a downward Alembic revision only when it is reversible. Otherwise restore an AlloyDB backup to a new instance, store the new connection string in Secret Manager, and start the previous image with that secret. Do not point a rolled-back image at a schema it cannot read, and do not delete the source instance until the restored instance has served a successful approval resume.

## Backup and restore

AlloyDB backups stay enabled in production. Restore drill, on a non-production project first:

1. Create or note a paused approval (`awaiting_approval`) and its run id.
2. Restore the backup to a new AlloyDB instance on the private network.
3. Add a new Secret Manager version for `DATABASE_URL` and deploy a revision that reads it.
4. From a new Cloud Run instance, approve the run. The tool executes once.
5. Call the same approval again and confirm the second decision is rejected as already decided.
6. Repeat a read with a token for another tenant and confirm an empty result.

## Secret rotation

Add a new Secret Manager version for the database password or the provider key. Deploy a new revision so running instances drop the old value. Vertex AI uses the Cloud Run service account (`roles/aiplatform.user`), not an API key in the image. Recycle both the API and the worker. Then run a staging chat and an ingestion job.

## Scaling

| Mode | API | Worker |
| --- | --- | --- |
| `serverless` | `min_instance_count = 0`. Concurrency and `max_instance_count` cap a spike. | Same scale-to-zero settings. Pub/Sub retries if the instance is cold. |
| `always_on` | Minimum instances stay up and CPU stays allocated, so chat and approval calls avoid cold starts. | Keep at least one instance so push delivery has a live target. Scale on instance count and request latency. |

Each instance's SQLAlchemy pool must stay small. Maximum instances times pool size must fit AlloyDB's connection limit. Direct VPC egress is required so instances reach the private AlloyDB address.

## Incidents

1. Pause the affected model or tenant budget.
2. Check dead-letter messages, 5xx, latency, instance count, and AlloyDB connections.
3. If a revision is unhealthy, send traffic to the previous revision.
4. Add a new secret version if credentials may be exposed, and deploy so old instances stop.
5. Delete affected corpora with the tenant-authenticated API.
6. If a reviewer gets `Approval not found` after a restart, the run was not in AlloyDB. Restore from backup. A new instance will not reconstruct it from Pub/Sub.
7. Re-run an authenticated ingest and a streamed chat with citations before opening traffic.

The shared checklist is on [Security and operations](./security). The image itself is in [Portable container](./container).

## What each product does

| GCP product | Role in the kit |
| --- | --- |
| Cloud Run | API and ingestion worker, either scale-to-zero or always on |
| Cloud Run Job | Alembic migration, once per release, before traffic shift |
| Identity Platform | OIDC issuer. The app checks JWKS, tenant, module, and permission |
| Vertex AI | Chat model and embeddings. The service account has `roles/aiplatform.user` |
| Cloud Storage | Original documents. Public access is blocked |
| Pub/Sub | Ingestion jobs and the dead-letter topic. Push to the worker only |
| Firestore | Job status recorded when a job is published |
| AlloyDB | Tenant data, agent runs, approvals, and pgvector retrieval. Required in production |
| Secret Manager | Provider credentials and `DATABASE_URL` |
