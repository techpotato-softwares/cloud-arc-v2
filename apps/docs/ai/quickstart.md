# Planned quickstart

These commands describe the first run of `forgearc-ai`. They are not executable until that folder exists.

```bash
docker compose up -d          # PostgreSQL with pgvector
cp .env.example .env          # OPENAI_API_KEY for local, or Bedrock config for AWS
uv sync --all-packages --frozen
uv run --package forgearc-ai-api alembic upgrade head
uv run --package forgearc-ai-api uvicorn --app-dir apps/api src.dev_server:app --reload --port 4020
```

## What you do on day one

1. `POST /api/login` against the platform auth route. The token must include the AI module.
2. Upload a PDF, DOCX, HTML, or Markdown file. The API stores the object and returns `{ "job_id", "status": "queued" }`.
3. Poll `GET /api/jobs/{job_id}`. The worker chunks the file, embeds it, and writes tenant-scoped rows.
4. `POST /api/ai/chat` or the stream route. The answer includes citations pointing at those chunks.
5. Delete the corpus for a user. That deletes their chunks and embeddings.

## Configuration

`forgearc-ai.yaml` is the source of truth, with environment overrides for secrets. The process exits if a production provider is selected and its credential is missing. The current stub's silent fallback is not part of this kit.

Local development uses OpenAI and pgvector. AWS uses Bedrock, S3, SQS, and Secrets Manager. The application calls the core interfaces, not the vendor SDK, so the same chat route runs in both places.

## What "done" means for a buyer

A clean checkout can log in, ingest one document, stream an answer that cites that document, and show token counts. `cdk synth` succeeds. Tests cover a tenant who must not read another tenant's chunks, and a budget set to zero that rejects the next call.
