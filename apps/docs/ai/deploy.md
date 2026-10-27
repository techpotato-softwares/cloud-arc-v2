# Deploy ForgeArc AI on AWS

AWS runs one of two compute modes against the same data plane. `runtime=lambda` scales to zero. `runtime=fargate` stays on. Both require Aurora PostgreSQL with pgvector. An always-on task does not keep approvals in process memory. Read [Why ForgeArc AI needs durable state](./durable-state) before you pick a mode, and [Production runtimes](./production) for the cost comparison.

## Before synthesis

Configure the AWS account and region, select Bedrock model IDs that are available in that region, and prepare provider secrets. The AWS adapter is the only package that imports `boto3`.

```bash
cd products/forgearc-ai/infra/cdk
pnpm dlx aws-cdk@2 synth AiStack-dev
pnpm dlx aws-cdk@2 synth AiStack-prod -c runtime=lambda
pnpm dlx aws-cdk@2 synth AiStack-prod -c runtime=fargate
```

<ArchitectureMap title="ForgeArc AI on AWS" preset="ai-aws" />

Shared infrastructure, created for either runtime:

| Piece | Role |
| --- | --- |
| VPC | Private workloads. No public database. |
| Aurora Serverless v2 | PostgreSQL with pgvector. Deletion protection in production. Automated backups and point-in-time recovery. |
| RDS Proxy | Pooled connections from Lambda or Fargate. |
| S3 | Original documents. Public access blocked. TLS required. |
| SQS and DLQ | Ingestion. Three receives, then the dead-letter queue. |
| Secrets Manager | Database credentials with rotation, plus provider keys when a provider needs one. Bedrock uses IAM. |
| KMS | Encryption for the data stores and secrets. |
| Cognito | User pool, app client, groups mapped to permissions, and a tenant claim. API Gateway JWT authorizer. |
| Alarms | DLQ depth, 5xx, latency, unhealthy tasks, database connections and capacity, and budget. SNS receives the DLQ alarm. |

Lambda attaches the API and the SQS worker to the VPC and RDS Proxy. The API is the FastAPI app behind API Gateway. The worker consumes the ingest queue.

Fargate runs private API and worker services. API Gateway reaches the API through a VPC Link and an internal load balancer. The API scales on CPU and request count. The worker scales on queue depth. Deployments use a circuit breaker. Tasks use a read-only filesystem, dropped Linux capabilities, and least-privilege task roles.

The dev synth can omit a full production Aurora cluster when you are only checking the template. A `prod` stack does not. Production startup exits without `DATABASE_URL`.

## Migrations

API and worker tasks never run Alembic when they start. Before shifting traffic to a new image:

1. Build and scan the portable image. See [Portable container](./container).
2. Run the one-off ECS migration task with that image digest and the production `DATABASE_URL` secret.
3. Wait until the task stops with exit code 0.
4. Deploy the API and worker. Lambda gets the new code bundle. Fargate rolls the services.

A failed migration stops the rollout. Do not start the new API against a half-applied schema.

## Rollback

Roll the API and worker back to the previous image digest or Lambda version. Shift traffic only after that version is healthy.

Roll the schema back with `alembic downgrade` only when the revision is reversible. When it is not, restore an Aurora snapshot or point-in-time backup to a new cluster, point the Secrets Manager database URL at that endpoint, and start the previous image against it. Do not drop the only production cluster to "undo" a release.

## Backup and restore

Production Aurora keeps automated backups, a retention window you set for the organization, and deletion protection. RDS Proxy stays the client endpoint so a restore can be introduced by updating the proxy target or the secret.

Restore drill, on staging first:

1. Pause an agent on a tool that requires approval, or note an existing `approvals` row and its `agent_runs` id.
2. Restore the cluster to a new cluster at a chosen time.
3. Put the new endpoint in the database secret. Restart API and worker tasks so they read it.
4. From a new task, approve the paused run. The tool runs once. A second decision finds the approval already decided.
5. Confirm another tenant cannot read the restored rows.

## Secret rotation

Database credentials rotate in Secrets Manager. RDS Proxy picks up the rotated password. Application tasks read the secret at start and on connection refresh. They do not embed the password in the image or in `agent_runs.state_json`.

Rotate the provider secret the same way when an API key may have leaked. Bedrock does not use that key. IAM is `InvokeModel` on the allowed model ids only. After rotation, recycle tasks so no process keeps the old value, then rerun the staging smoke test.

Cognito app clients are not a substitute for the database secret. Tokens are verified on each request. Local HMAC tokens and `local_users` are rejected when `FORGEARC_AI_ENVIRONMENT=prod`.

## Scaling

| Mode | API | Worker |
| --- | --- | --- |
| Lambda | Concurrency follows requests and drops to zero when idle. Set reserved concurrency if a tenant must not consume the account pool. | SQS event source, batch size 1. The function timeout is longer than the API timeout. |
| Fargate | Scale on CPU and request count. Minimum task count stays above zero. The deployment circuit breaker stops a bad rollout. | Scale on visible queue depth. Keep the API and worker on separate services so a document backlog does not starve chat. |

Aurora minimum ACUs must cover the connection spike when either mode scales out. RDS Proxy absorbs that spike. Raising Fargate task count without raising the proxy and ACU ceiling exhausts connections even though CPU looks fine.

## Smoke gate

```bash
FORGEARC_AWS_SMOKE=1 bash products/forgearc-ai/scripts/smoke_aws.sh
```

Acceptance requires authentication, ingestion, completed job state, a real Bedrock streamed answer with citations, and a recorded token cost.

## Incidents

1. Pause the affected model or tenant budget.
2. Check DLQ depth, 5xx, latency, unhealthy task count, and Aurora connections and capacity.
3. If a deploy is in progress, let the Fargate circuit breaker roll back, or shift Lambda alias traffic to the last known version.
4. Rotate the Secrets Manager value if credentials may be exposed, then recycle tasks.
5. Delete affected corpora with the tenant-authenticated API. Do not delete from a console query that omits `tenant_id`.
6. If approvals or jobs are missing after a crash, restore Aurora using the steps above. Do not expect a new task to remember `MemoryRepository`.
7. Re-run the gated staging smoke test before restoring traffic.

The shared checklist is on [Security and operations](./security).
