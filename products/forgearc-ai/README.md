# ForgeArc AI

Python-first AI product for teams that want chat, retrieval, and typed decisions without giving up the source. The local API is FastAPI. AWS deployment is Python CDK. GCP deployment is Terraform. OpenAI is the local model provider, Amazon Bedrock is the AWS provider, Vertex AI is the GCP provider, and TypeSafe AI Jev is the decision model.

## Layout

```text
apps/api                 FastAPI host, feature controllers, and worker entry
packages/core/services   Chat, ingestion, decision, usage, agent, and evaluation services
packages/core/repositories  Persistence records and repository implementations
packages/core            Contracts, policy, retrieval, graphs, OpenAI, and Jev
packages/aws_adapter     Bedrock, S3, SQS, Secrets Manager, and IAM statements
packages/gcp_adapter     Vertex AI, Cloud Storage, Pub/Sub, Firestore, and Secret Manager
infra/cdk                Shared VPC, Aurora, and either Lambda or Fargate
infra/terraform          Cloud Run serverless or always-on, AlloyDB, Identity Platform
migrations               Alembic schema, with pgvector on PostgreSQL
```

Application code calls the core interfaces. The AWS adapter is the only package that imports boto3. The GCP adapter is the only package that imports the Google Cloud client libraries.

Controllers are split by feature under `apps/api/src/forgearc_ai_api/controllers`.
Their `__init__.py` is the single import index that registers every decorated
route. Controllers validate HTTP input and delegate to services; services own
business rules; repositories own persistence. Cloud SDK adapters remain behind
the core contracts.

## Configuration

The standard configuration selects a preset:

```yaml
environment: local
cloud: local
```

Use `cloud: aws` or `cloud: gcp` outside managed infrastructure. AWS CDK and
GCP Terraform set that value and all generated resource identifiers
automatically during deployment. Provider blocks remain available as optional
overrides, not required setup.

## Local run

```bash
docker compose up -d
cp .env.example .env
uv sync --all-packages --frozen
uv run --package forgearc-ai-api alembic -c migrations/alembic.ini upgrade head
uv run --package forgearc-ai-api uvicorn forgearc_ai_api.app:app --port 4020
```

From the repository root, set `FORGEARC_AI_CONFIG` to this directory's `forgearc-ai.yaml` when the command is not already run from the product. Production startup exits without `DATABASE_URL`, without OIDC (`auth.mode: oidc` plus issuer, audience, and JWKS URL), or when the selected provider credential or pinned Jev version is missing. `fake`, `jev-latest`, `jev-preview`, local users, and wildcard CORS are rejected in production.

Log in with the local user in `forgearc-ai.yaml`, upload a document, poll the job, then call `POST /api/ai/chat/stream`. The stream includes citations and token cost. `GET /api/usage` returns the tenant ledger. `POST /api/decisions/evaluate` calls Jev for Choice, Score, and Boolean answers and marks low-confidence answers for review.

## Agents, approvals, and evaluation (AI Pro)

- `POST /api/agents/run` runs a tool-calling agent. Risky tools such as `notify_webhook` pause the run until a second user approves it.
- `GET /api/approvals` and `POST /api/approvals/{approvalId}` list and decide those tool calls. Log in as `reviewer@forgearc.dev` to approve locally.
- `POST /api/agents/supervise` lets a supervisor delegate to the `researcher` and `operator` agents.
- `POST /api/evaluations` scores RAG samples with RAGAS metric names; `GET /api/usage/dashboard` and `/dashboard` show spend by model, feature, and day.

The agent graph runs without extra packages. `uv sync --all-packages --extra langgraph --extra ragas` adds LangGraph compilation and the RAGAS evaluation engine.

## Why ForgeArc AI needs durable state

`MemoryRepository` keeps jobs, vectors, conversations, usage, agent runs, approvals, and evaluations inside one Python process. An agent that pauses for approval loses that run when Lambda or a container restarts, or when the reviewer reaches another replica. Always-on Fargate, ECS, EC2, Cloud Run, or Compute Engine does not fix it: deploys, crashes, health replacement, and extra replicas still drop or split process memory.

Production requires PostgreSQL with pgvector so the approval row and `agent_runs.state_json` are still there for the next process. Aurora Serverless v2 is that database on AWS. AlloyDB is that database on GCP. Memory remains local and test only. The decision record, rejected alternatives, and acceptance tests are in `apps/docs/ai/durable-state.md`.

## AWS

Lambda scales to zero. Fargate stays on. Both use the same Aurora database, Cognito, and private network. Pass the choice at synth time:

```bash
cd infra/cdk
pnpm dlx aws-cdk@2 synth AiStack-dev
pnpm dlx aws-cdk@2 synth AiStack-prod -c runtime=lambda
pnpm dlx aws-cdk@2 synth AiStack-prod -c runtime=fargate
```

The stack is least-privilege: document read/write, queue send or receive, secret read, and Bedrock invoke on foundation models. Ingestion retries three times and then enters the dead-letter queue, which raises an alarm. The staging smoke check is gated:

```bash
bash scripts/smoke_aws.sh
FORGEARC_AWS_SMOKE=1 bash scripts/smoke_aws.sh
```

## GCP

Cloud Run serverless scales to zero (`runtime_mode=serverless`, `min_instance_count = 0`). Cloud Run always-on keeps minimum instances and CPU allocated (`runtime_mode=always_on`). AlloyDB is required for `environment=prod`. Identity Platform is the OIDC issuer.

```bash
cd infra/terraform
terraform init -backend=false
terraform validate
```

See `infra/terraform/README.md` before apply. Vertex AI, Cloud Storage, Pub/Sub, Firestore, and AlloyDB stay behind the same document, queue, and model interfaces used on AWS. Firestore still records job status. Approvals and embeddings are in AlloyDB.

Operations for migrations, rollback, backup and restore, secret rotation, scaling, and incidents are in `apps/docs/ai/deploy.md` and `apps/docs/ai/deploy-gcp.md`. The portable image for ECS on EC2, EKS, GKE, Compute Engine, and Docker is `apps/docs/ai/container.md`. Runtime cost and the minimum production bar are `apps/docs/ai/production.md`.

PostgreSQL with pgvector runs locally through Docker. The migration enables the extension and adds `embedding_vec` only on PostgreSQL. SQLite and the in-memory store used by tests keep embeddings in JSON and filter every search by `tenant_id`.
