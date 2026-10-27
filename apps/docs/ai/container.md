# Portable container

The production artifact is one OCI image. AWS Lambda or Fargate, and GCP Cloud Run, run that image. The same image is what you run yourself on ECS on EC2, EKS, GKE, Compute Engine, or Docker. This repository does not provision EC2 clusters, GKE, or Compute Engine. Those platforms are documented here so the image stays portable. Pick a managed runtime in [Production runtimes](./production) when you want the CDK or Terraform stack to create the service.

## Image contract

Build from `products/forgearc-ai`. The image is multi-stage, runs as a non-root user, and has a read-only root filesystem in the Fargate task definition. No cloud credential, database password, or JWT material is copied into the layers. The platform injects them when the container starts.

| Command | Process |
| --- | --- |
| `api` | `uvicorn` serving the FastAPI app, including `GET /health` and `/internal/pubsub` |
| `worker` | On AWS, long-poll SQS and run ingestion. On GCP, this same image is the worker service and receives authenticated Pub/Sub push at `/internal/pubsub`. |
| `migrate` | `alembic upgrade head` against `DATABASE_URL`, then exit. |

`GET /health` returns `{"status":"ok","product":"forgearc-ai"}`. Use it as the liveness probe. Treat a replica as ready only when it can open `DATABASE_URL`. A task that cannot reach PostgreSQL must stay out of the load balancer.

The API and worker shut down on `SIGTERM`, finish the in-flight request or job within the platform's stop grace period, and exit. Concurrency is bounded by the platform setting (Lambda reserved concurrency, Fargate task count, or Cloud Run concurrency) and by `limits` in configuration.

```bash
docker build -t forgearc-ai:local products/forgearc-ai
docker run --rm -p 4020:4020 --env-file .env forgearc-ai:local api
docker run --rm --env-file .env forgearc-ai:local worker
docker run --rm --env-file .env forgearc-ai:local migrate
```

Required runtime environment:

| Variable | Role |
| --- | --- |
| `FORGEARC_AI_ENVIRONMENT` | `prod` outside local and test |
| `FORGEARC_AI_CLOUD` | `aws` or `gcp` |
| `DATABASE_URL` | Aurora, AlloyDB, or any PostgreSQL with pgvector |
| `FORGEARC_AI_BUCKET` | Private document bucket |
| `FORGEARC_AI_QUEUE_URL` | SQS queue URL or Pub/Sub topic |
| `FORGEARC_AI_SECRET_ID` | Secret that holds provider credentials when the provider needs a key |
| `AWS_REGION` or `GCP_PROJECT` and `GCP_LOCATION` | Region for Bedrock or Vertex AI |

`MemoryRepository` is not available once `FORGEARC_AI_ENVIRONMENT=prod`. See [Why ForgeArc AI needs durable state](./durable-state).

## Local Docker

`products/forgearc-ai/docker-compose.yml` starts PostgreSQL 16 with pgvector as database `forgearc_ai`, user `forgearc`, on host port `5433`. Run the migration container to completion before the API container. Then start the API and the worker from the same image. Restarting the API container must leave paused approvals in Postgres.

```bash
cd products/forgearc-ai
docker compose up -d
docker run --rm --network host -e DATABASE_URL=postgresql+psycopg://forgearc:forgearc@localhost:5433/forgearc_ai forgearc-ai:local migrate
docker run --rm --network host -p 4020:4020 --env-file .env forgearc-ai:local api
```

Set `DATABASE_URL` in `.env` to that same URL for the API and worker. Do not point production at this compose database.

## Migrations on every platform

Run `migrate` as a one-off job and wait for exit code 0 before shifting traffic to the new API revision. Do not run Alembic from the API process on startup. Two replicas migrating at once will race. After a bad release, roll the image back. Run `alembic downgrade` only when that revision is reversible. Otherwise restore a database backup and point `DATABASE_URL` at the restored endpoint before the previous image starts. Backup steps are in the [AWS](./deploy) and [GCP](./deploy-gcp) guides.

## ECS on EC2

Use the image in an ECS task definition on an EC2 capacity provider when you already operate that cluster. Run three task families from the definitions you manage yourself:

- A service for `api` behind your load balancer, in private subnets, with the database security group allowing the task security group on port 5432.
- A service for `worker` with no public ingress. On AWS it needs `sqs:ReceiveMessage` and `sqs:DeleteMessage` on the ingest queue.
- A one-off task for `migrate` that uses the new image digest. Wait for it to stop with exit code 0, then update the API service.

Task roles are the only AWS credentials. Drop Linux capabilities and keep the filesystem read-only, matching the Fargate service. Scale the worker on queue depth and the API on CPU. This path is not created by `AiStack`.

## EKS

Deploy the same image as Deployment objects for `api` and `worker`, plus a Job for `migrate`. Store `DATABASE_URL` and provider secrets in Kubernetes secrets sourced from your secret manager, or use a CSI driver. The Job must complete before the API rollout. Readiness fails while PostgreSQL is unreachable. The worker Service is ClusterIP. Nothing in the ForgeArc CDK or Terraform stack installs this cluster.

## GKE

The layout matches EKS: a Deployment for `api`, a Deployment for `worker`, and a Job for `migrate`. On GCP the worker receives Pub/Sub push, so give only the Pub/Sub invoker identity permission to call the worker, and set worker ingress to internal. Workload Identity supplies the Vertex AI, Storage, and Secret Manager roles. AlloyDB is reached over a private IP. The Terraform stack in this repository creates Cloud Run, not this cluster.

## Compute Engine

A VM runs the image under a process manager. One unit runs `api`, one runs `worker`, and a startup script runs `migrate` once per release and blocks the API unit until it exits 0. Put the VM on a private subnet with a load balancer in front of the API only. Instance metadata or the guest environment supplies ADC for Vertex or the AWS CLI equivalent. Instance disk is scratch space for the container runtime, not the store for approvals. Attach the VM to AlloyDB or Aurora over the private network. This repository does not create the VM.

## Docker on a single host

The local commands above are the single-host layout. Put a TLS proxy in front of port 4020. Keep Postgres on a volume you snapshot. Run `migrate` before replacing the API container. This is a valid way to operate the image. It is not the AWS or GCP stack, and it still requires PostgreSQL with pgvector rather than `MemoryRepository`.

## Release checks

The release pipeline builds this image, scans it, and smoke-tests `api` and `worker` before the digest is deployed. Promote by digest. A tag that moves is not a rollback target. Identity, network, and alarm requirements stay in [Security and operations](./security).
