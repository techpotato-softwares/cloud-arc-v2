# AWS and GCP architecture

The same API image and the same PostgreSQL repository run on both clouds. Each cloud offers a serverless runtime and an always-on runtime. Both require the database. [Why ForgeArc AI needs durable state](./durable-state) explains the approval failure that makes process memory unfit for production. Choose a mode in [Production runtimes](./production).

<ArchitectureMap title="ForgeArc AI on AWS" preset="ai-aws" />

<Mermaid chart="flowchart LR
  client[Client] --> cognito[Cognito]
  cognito --> apigw[API_Gateway]
  apigw --> api[Lambda_or_Fargate]
  api --> bedrock[Bedrock]
  api --> db[(Aurora_pgvector)]
  api --> queue[SQS]
  queue --> worker[Lambda_or_Fargate_worker]
  worker --> s3[S3]
  worker --> db
  worker --> bedrock
  queue --> dlq[DLQ]" />

| AWS product | Role in the kit |
| --- | --- |
| API Gateway | HTTP API and the SSE chat route. JWT authorizer in front. |
| Cognito | User pool, groups mapped to permissions, and a tenant claim |
| Lambda or Fargate | Chat, retrieval, agents, and job creation. Lambda scales to zero. Fargate stays on. CDK context `runtime=lambda` or `runtime=fargate`. |
| Bedrock | Chat model and embeddings. IAM is `InvokeModel` on the allowed model ids only |
| S3 | Original documents. The bucket is private |
| SQS | Ingestion jobs. Three retries, then the DLQ |
| Worker | Load, chunk, embed, write vectors. Lambda or Fargate, same choice as the API |
| Aurora Serverless v2 | Tenants, documents, chunks, jobs, conversations, usage, agent runs, approvals, and evaluations. pgvector for embeddings. Required in both runtimes |
| RDS Proxy | Connection pooling for Lambda and Fargate |
| Secrets Manager | Database credentials and an OpenAI key when that provider is enabled. Bedrock uses IAM |

Dev keeps the database in Docker. A production stack creates Aurora. The dev CDK synth does not have to create it.

<ArchitectureMap title="ForgeArc AI on GCP" preset="ai-gcp" />

<Mermaid chart="flowchart LR
  client[Client] --> identity[Identity_Platform]
  identity --> run[Cloud_Run_API]
  run --> vertex[Vertex_AI]
  run --> db[(AlloyDB_pgvector)]
  run --> topic[Pub_Sub]
  topic --> worker[Cloud_Run_worker]
  worker --> gcs[Cloud_Storage]
  worker --> db" />

| GCP product | Same role as |
| --- | --- |
| Cloud Run serverless or always-on | Lambda or Fargate. `runtime_mode=serverless` uses `min_instance_count = 0`. `always_on` keeps minimum instances and CPU allocated |
| Identity Platform | Cognito |
| Vertex AI | Bedrock |
| Cloud Storage | S3 |
| Pub/Sub | SQS. Authenticated push to the worker only |
| Firestore | Job status when a job is published. Approvals stay in AlloyDB |
| AlloyDB with pgvector | Aurora. Required when `environment` is `prod` |
| Secret Manager | Secrets Manager, including `DATABASE_URL` |
| Cloud Run Job | One-off Alembic migration before traffic shift |

The GCP adapter is `products/forgearc-ai/packages/gcp_adapter`. Terraform for that edition is in `products/forgearc-ai/infra/terraform`, and every ForgeArc AI plan includes it. See [GCP deployment](./deploy-gcp) and [AWS deployment](./deploy). The image also runs on ECS on EC2, EKS, GKE, Compute Engine, and Docker without a separate stack. See [Portable container](./container).

Service marks in the diagrams are original glyphs with the product name. See [Icon policy](/architecture/icons).
