# ForgeArc AI on GCP

Terraform creates the GCP edition behind the same application interfaces as the AWS CDK stack.

The stack configures both containers with the GCP preset and generated
resource names. A buyer supplies only the project, region if different from the
default, and container image; no provider/storage/queue YAML block is needed.

| Resource | Application role |
| --- | --- |
| Cloud Run API | FastAPI host |
| Vertex AI | Chat and embeddings. The API service account has `roles/aiplatform.user` |
| Cloud Storage | Original documents. Public access is blocked |
| Pub/Sub | Ingestion jobs. Delivery fails into the dead-letter topic after five attempts, the Pub/Sub minimum |
| Cloud Run worker | Receives the push subscription, then loads, chunks, and embeds |
| Firestore | Job status written when a job is published |
| AlloyDB | PostgreSQL with pgvector. Set `enable_alloydb = false` to skip it |
| Secret Manager | Provider credentials and the generated database password |

```bash
cd products/forgearc-ai/infra/terraform
terraform init
terraform apply \
  -var project_id=YOUR_PROJECT \
  -var container_image=REGION-docker.pkg.dev/YOUR_PROJECT/forgearc/api:1.0.0
```

Vertex AI has no separate model resource. Enablement of `aiplatform.googleapis.com` plus the allowlisted model names in `forgearc-ai.yaml` is the equivalent of the Bedrock invoke permission.

Pub/Sub calls the worker's `/internal/pubsub` endpoint with an OIDC token. The
worker service account is the only invoker. Job messages include the document
metadata needed by a fresh worker instance, while document bytes remain in
Cloud Storage.
