# Quickstart

Run these commands from `products/forgearc-ai`.

```bash
docker compose up -d
cp .env.example .env
uv sync --all-packages --frozen
uv run --package forgearc-ai-api alembic -c migrations/alembic.ini upgrade head
uv run --package forgearc-ai-api uvicorn forgearc_ai_api.app:app --port 4020
```

## What you do on day one

1. `POST /api/auth/login` with the local user in `forgearc-ai.yaml`. The token includes the `ai` module and `ai:*` permissions.
2. Upload a PDF, DOCX, HTML, or Markdown file. The API stores the object and returns `{ "jobId", "status" }`.
3. Poll `GET /api/jobs/{job_id}`. The worker chunks the file, embeds it, and writes tenant-scoped rows.
4. `POST /api/ai/chat/stream`. The answer includes citations and token cost.
5. `GET /api/usage` reports the tenant ledger. Delete a corpus with `DELETE /api/corpora/{corpus_id}`.
6. `POST /api/decisions/evaluate` sends state to Jev and returns typed answers. Low confidence is marked for review.

## Configuration

`forgearc-ai.yaml` is the source of truth, with environment overrides for secrets. The process exits if a production provider is selected and its credential is missing.

Local development uses OpenAI and pgvector. AWS uses Bedrock, S3, SQS, and Secrets Manager. The application calls the core interfaces, not the vendor SDK, so the same chat route runs in both places.

## What "done" means for a buyer

A clean checkout can log in, ingest one document, stream an answer that cites that document, and show token counts. `cdk synth` succeeds. Tests cover a tenant who must not read another tenant's chunks, and a budget set to zero that rejects the next call.
