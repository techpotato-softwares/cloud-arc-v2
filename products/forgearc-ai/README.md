# ForgeArc AI

Python-first AI product for teams that want chat, retrieval, and typed decisions without giving up the source. The local API is FastAPI. AWS deployment is Python CDK. OpenAI is the local model provider, Amazon Bedrock is the AWS provider, and TypeSafe AI Jev is the decision model.

## Layout

```text
apps/api                 FastAPI host, controllers, and worker entry
packages/core            Contracts, policy, retrieval, OpenAI, and Jev
packages/aws_adapter     Bedrock, S3, SQS, Secrets Manager, and IAM statements
infra/cdk                API Gateway, Lambdas, queue, dead-letter alarm, bucket, secret
migrations               Alembic schema, with pgvector on PostgreSQL
```

Application code calls the core interfaces. The AWS adapter is the only package that imports boto3.

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

PostgreSQL with pgvector runs locally through Docker. The migration enables the extension and adds `embedding_vec` only on PostgreSQL. SQLite and the in-memory store used by tests keep embeddings in JSON and filter every search by `tenant_id`.
