# AWS and GCP architecture

AWS is the first adapter and is implemented in `products/forgearc-ai`. GCP is drawn now so the core does not import a cloud SDK directly.

<ArchitectureMap title="ForgeArc AI on AWS" preset="ai-aws" />

<Mermaid chart="flowchart LR
  client[Client] --> apigw[API_Gateway]
  apigw --> api[API_Lambda]
  api --> bedrock[Bedrock]
  api --> db[(PostgreSQL_pgvector)]
  api --> queue[SQS]
  queue --> worker[Ingestion_worker]
  worker --> s3[S3]
  worker --> db
  worker --> bedrock
  queue --> dlq[DLQ]" />

| AWS product | Role in the kit |
| --- | --- |
| API Gateway | Public HTTP and the SSE chat route |
| API Lambda | Auth already done by the platform layer, then chat, retrieval, and job creation |
| Bedrock | Chat model and embeddings. IAM is `InvokeModel` on the allowed model ids only |
| S3 | Original documents. The bucket is private |
| SQS | Ingestion jobs. Three retries, then the DLQ |
| Worker Lambda | Load, chunk, embed, write vectors. Longer timeout than the API function |
| RDS PostgreSQL | Tenants, documents, chunks, jobs, and the cost ledger. pgvector for embeddings |
| Secrets Manager | OpenAI key when that provider is enabled. Bedrock uses IAM, not an API key |

Dev keeps the database in Docker. The dev CDK stack does not have to create RDS.

<ArchitectureMap title="ForgeArc AI on GCP" preset="ai-gcp" />

<Mermaid chart="flowchart LR
  client[Client] --> run[Cloud_Run]
  run --> vertex[Vertex_AI]
  run --> db[(AlloyDB)]
  run --> topic[Pub_Sub]
  topic --> worker[Cloud_Run_worker]
  worker --> gcs[Cloud_Storage]
  worker --> db" />

| GCP product | Same role as |
| --- | --- |
| Cloud Run | API Lambda and the worker |
| Vertex AI | Bedrock |
| Cloud Storage | S3 |
| Pub/Sub | SQS |
| AlloyDB with pgvector | RDS |
| Secret Manager | Secrets Manager |

The GCP adapter is `products/forgearc-ai/packages/gcp_adapter`. Terraform for that edition is in `products/forgearc-ai/infra/terraform`, and the Starter GCP plan includes it. See [GCP deployment](./deploy-gcp).

Service marks in the diagrams are original glyphs with the product name. See [Icon policy](/architecture/icons).
