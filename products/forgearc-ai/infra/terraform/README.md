# ForgeArc AI on GCP

Terraform creates the GCP edition behind the same application interfaces as the AWS CDK stack.

The stack configures both containers with the GCP preset and generated
resource names. A buyer supplies the project, container image, and runtime mode.
No provider/storage/queue YAML block is needed.

| Resource | Application role |
| --- | --- |
| Cloud Run API | FastAPI host. `runtime_mode=serverless` scales to zero. `always_on` keeps minimum instances with CPU always allocated |
| Cloud Run worker | Internal ingress. Pub/Sub push calls `/internal/pubsub` with an OIDC token. Only that identity has `run.invoker` |
| Cloud Run migration job | One-off `alembic upgrade head` against AlloyDB. Run it before shifting traffic; replicas do not migrate on startup |
| Vertex AI | Chat and embeddings. The API and worker service accounts have `roles/aiplatform.user` |
| Cloud Storage | Original documents. Public access is blocked. Optional regional CMEK |
| Pub/Sub | Ingestion jobs. Delivery fails into the dead-letter topic after five attempts. Optional global CMEK |
| Firestore | Job status written when a job is published |
| AlloyDB | PostgreSQL 15 with private IP, daily backups, and continuous backup. Required when `environment` is `prod` |
| Secret Manager | `DATABASE_URL`, `JWT_SECRET`, and the generated database password. Optional regional CMEK |
| Identity Platform or external OIDC | Production requires one of them. Issuer, audience, and JWKS URL are injected for the application verifier |
| Cloud Monitoring | Alerts for dead-letter messages, 5xx, p95 latency, instance saturation, and AlloyDB connections |

```bash
cd products/forgearc-ai/infra/terraform
terraform init
terraform apply \
  -var project_id=YOUR_PROJECT \
  -var container_image=REGION-docker.pkg.dev/YOUR_PROJECT/forgearc/api:1.0.0 \
  -var runtime_mode=serverless
```

Production:

```bash
terraform apply \
  -var project_id=YOUR_PROJECT \
  -var environment=prod \
  -var runtime_mode=always_on \
  -var enable_alloydb=true \
  -var enable_identity_platform=true \
  -var container_image=REGION-docker.pkg.dev/YOUR_PROJECT/forgearc/api:1.0.0
```

`environment=prod` fails the plan unless AlloyDB is enabled and either
`enable_identity_platform` is true or `oidc_issuer`, `oidc_audience`, and
`oidc_jwks_url` are all set. Explicit OIDC values override the Identity
Platform issuer. Non-production stacks may set `enable_alloydb=false`.
Identity Platform users must receive `tenant_id`, `permissions`, `modules`,
and optional `groups` custom claims from a trusted provisioning service;
Terraform enables the provider but does not assign per-user authorization.

Direct VPC egress sends private traffic to AlloyDB. Other Google APIs stay on
the default path. The runtime subnet defaults to `192.168.16.0/24` and must not
overlap the private services range.

Run migrations before serving a new schema:

```bash
gcloud run jobs execute forgearc-ai-prod-migrate \
  --region REGION \
  --project YOUR_PROJECT \
  --wait
```

Set `enable_cmek=true` to create a regional key for Storage and Secret Manager
and a global key for Pub/Sub. Pass `kms_key_name` and `pubsub_kms_key_name` to
use existing keys. The first apply can need a retry if a CMEK service agent is
still being created.

`notification_channels` attaches existing Cloud Monitoring channels to the
alerts. Firestore remains the job-status store.

Vertex AI has no separate model resource. Enablement of `aiplatform.googleapis.com` plus the allowlisted model names in `forgearc-ai.yaml` is the equivalent of the Bedrock invoke permission.

The worker service account is the Pub/Sub OIDC identity and the only Cloud Run
invoker on the worker. Job messages include the document metadata needed by a
fresh worker instance, while document bytes remain in Cloud Storage.
