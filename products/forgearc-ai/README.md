# ForgeArc AI

Python-first AI product for teams that want chat, retrieval, and typed decisions without giving up the source. The local API is FastAPI. AWS deployment is Python CDK. GCP deployment is Terraform. OpenAI is the local model provider, Amazon Bedrock is the AWS provider, Vertex AI is the GCP provider, and TypeSafe AI Jev is the decision model.

## Layout

```text
apps/api                 FastAPI host, controllers, and worker entry
packages/core            Contracts, policy, retrieval, OpenAI, and Jev
packages/aws_adapter     Bedrock, S3, SQS, Secrets Manager, and IAM statements
packages/gcp_adapter     Vertex AI, Cloud Storage, Pub/Sub, Firestore, and Secret Manager
infra/cdk                API Gateway, Lambdas, queue, dead-letter alarm, bucket, secret
infra/terraform          Cloud Run, Vertex AI, Storage, Pub/Sub, Firestore, AlloyDB, Secret Manager
migrations               Alembic schema, with pgvector on PostgreSQL
```

Application code calls the core interfaces. The AWS adapter is the only package that imports boto3. The GCP adapter is the only package that imports the Google Cloud client libraries.

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

From the repository root, set `FORGEARC_AI_CONFIG` to this directory's `forgearc-ai.yaml` when the command is not already run from the product. Production startup exits when the selected provider's credential, JWT secret, or pinned Jev version is missing. `fake`, `jev-latest`, and `jev-preview` are rejected in production.

Log in with the local user in `forgearc-ai.yaml`, upload a document, poll the job, then call `POST /api/ai/chat/stream`. The stream includes citations and token cost. `GET /api/usage` returns the tenant ledger. `POST /api/decisions/evaluate` calls Jev for Choice, Score, and Boolean answers and marks low-confidence answers for review.

## AWS

```bash
cd infra/cdk
pnpm dlx aws-cdk@2 synth AiStack-dev
```

The stack is least-privilege: document read/write, queue send or receive, secret read, and Bedrock invoke on foundation models. Ingestion retries three times and then enters the dead-letter queue, which raises an alarm. The staging smoke check is gated:

```bash
bash scripts/smoke_aws.sh
FORGEARC_AWS_SMOKE=1 bash scripts/smoke_aws.sh
```

## GCP

```bash
cd infra/terraform
terraform init -backend=false
terraform validate
```

See `infra/terraform/README.md` before apply. Vertex AI, Cloud Storage, Pub/Sub, Firestore, and AlloyDB stay behind the same document, queue, and model interfaces used on AWS.

PostgreSQL with pgvector runs locally through Docker. The migration enables the extension and adds `embedding_vec` only on PostgreSQL. SQLite and the in-memory store used by tests keep embeddings in JSON and filter every search by `tenant_id`.
