# Production runtimes

ForgeArc AI runs the same container image and the same repository contract on AWS and GCP. Each cloud has a serverless mode and an always-on mode. Both modes use durable PostgreSQL with pgvector. Turning a service "always on" removes cold starts. It does not keep agent approvals, jobs, or embeddings after a restart. That requirement is explained in [Why ForgeArc AI needs durable state](./durable-state).

<Mermaid chart="flowchart LR
  subgraph aws [AWS]
    awsGateway[API_Gateway] --> awsRuntime[Lambda_or_Fargate]
    cognito[Cognito] --> awsGateway
    awsRuntime --> sqs[SQS]
    awsRuntime --> aurora[Aurora_pgvector]
    awsRuntime --> s3[S3]
  end
  subgraph gcp [GCP]
    gcpEntry[Cloud_Run_HTTPS] --> gcpRuntime[Cloud_Run_serverless_or_always_on]
    identity[Identity_Platform] --> gcpRuntime
    gcpRuntime --> pubsub[PubSub]
    gcpRuntime --> alloy[AlloyDB_pgvector]
    gcpRuntime --> gcs[Cloud_Storage]
  end
  image[Portable_OCI_image] --> awsRuntime
  image --> gcpRuntime
  image --> other[ECS_on_EC2_EKS_GKE_Compute_Engine_Docker]" />

## Choose a runtime

| Cloud | Serverless | Always on | How to select |
| --- | --- | --- | --- |
| AWS | Lambda. Scales to zero. API Gateway HTTP API invokes the API. SQS invokes the worker. | ECS Fargate. Tasks stay running behind API Gateway, a VPC Link, and an internal load balancer. | CDK context `runtime=lambda` or `runtime=fargate` |
| GCP | Cloud Run with `min_instance_count = 0`. Scale to zero. | Cloud Run with minimum instances and CPU always allocated. Same continuous behavior as Fargate, without a cluster. | Terraform `runtime_mode=serverless` or `runtime_mode=always_on` |

The portable image also runs on ECS on EC2, EKS, GKE, Compute Engine, and Docker. This repository does not provision those platforms. The [portable container guide](./container) covers them.

Use serverless when traffic is spiky and cold starts are acceptable. Use always-on when approval and chat latency must stay flat. Use the same database, identity, and migration job either way.

## Why every mode needs durable state

Lambda, Fargate, Cloud Run serverless, and Cloud Run always-on all replace processes. A paused agent stores `awaiting_approval` in `agent_runs.state_json` and a row in `approvals`. The next process, including a warm Fargate task that was just deployed, loads that row from Aurora or AlloyDB. It does not load it from the previous process.

Production startup exits when `DATABASE_URL` is unset. `MemoryRepository` is limited to local and test.

## Minimum production requirements

All of the following are required before production traffic:

- `environment` is `prod`. Fake providers, local users, and HMAC login are rejected.
- `DATABASE_URL` points at Aurora (AWS) or AlloyDB (GCP). AlloyDB is mandatory when the GCP environment is `prod`.
- Identity is OIDC. Cognito and an API Gateway JWT authorizer on AWS. Identity Platform on GCP, with the application checking JWKS on every request. The app re-checks issuer, audience, expiry, tenant, module, and permission.
- The workload is private. HTTPS only. Documents stay in a private S3 bucket or a Cloud Storage bucket with public access blocked.
- Encryption uses KMS on AWS. CMEK is available for Cloud Storage, Pub/Sub, and Secret Manager on GCP.
- Secrets live in Secrets Manager or Secret Manager, with rotation. They are injected at runtime. They are not baked into the image and they are not written to `state_json`.
- Migrations run once, as an ECS task or a Cloud Run Job, before the new API revision takes traffic. API replicas do not migrate on startup.
- Alarms cover the dead-letter queue, 5xx responses, latency, unhealthy tasks or instance count, database connections and capacity, and budget.
- CORS is an explicit origin list. Request and upload sizes stay bounded. Logs are redacted. Audit events are retained.
- Backups and, on AWS production, deletion protection are enabled. A restore has been rehearsed on staging.

Commands, rollback, backup, rotation, scaling, and incidents are on the [AWS deployment](./deploy) and [GCP deployment](./deploy-gcp) pages. Day-to-day controls are in [Security and operations](./security).

## Cost comparison

Prices move. Compare the bill you actually pay, not a single monthly number. Serverless compute can go to zero. The database and the always-on floor cannot.

| Choice | What creates the bill | Idle behavior | Latency |
| --- | --- | --- | --- |
| Lambda | Requests and GB-seconds, plus NAT if the function is in a VPC to reach Aurora | No compute charge while idle | Cold start after idle, longer with a VPC attachment |
| Fargate | vCPU and memory for each running task, and the load balancer | The minimum task count stays up | Steady, aside from deploys |
| Cloud Run serverless | Requests, CPU, and memory while instances handle work, with `min_instance_count = 0` | No instance charge at zero | Cold start after idle |
| Cloud Run always-on | CPU allocated for the minimum instances even between requests | Those instances stay up | Steady, aside from deploys |
| Aurora Serverless v2 | Minimum ACUs, storage, I/O, backups, and RDS Proxy | The cluster remains when Lambda is at zero | Shared by Lambda and Fargate |
| AlloyDB | Primary instance, storage, and backups | Remains when Cloud Run is at zero | Required for `environment=prod` |
| Cognito or Identity Platform | Monthly active users and token traffic | Independent of the runtime mode | Token check on every request |

A quiet tenant on Lambda or scale-to-zero Cloud Run still pays for Aurora or AlloyDB, secret storage, and backups. An always-on service adds a compute floor on top of that database. Raising Aurora minimum ACUs, or AlloyDB instance size, is how you buy headroom for connection spikes when Cloud Run or Lambda scales out.

Connection pooling is part of the cost and the reliability plan. RDS Proxy holds Aurora connections for Lambda and Fargate. On Cloud Run, a large pool per instance exhausts AlloyDB when the service scales. Size the pool from the maximum instance count.

## What does not change between modes

- The image commands are `api` and `worker`. The worker long-polls SQS on AWS. On GCP it receives authenticated Pub/Sub push at `/internal/pubsub`.
- Chat, retrieval, decisions, agents, approvals, evaluation, and the cost dashboard use the same routes.
- Firestore still records job status on GCP. It is not the approval store.
- S3 and Cloud Storage hold original documents. The database holds tenant rows and embeddings.
