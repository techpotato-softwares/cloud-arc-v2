# ForgeArc AI setup

1. Accept the private repository invite sent to the license email.
2. Copy `products/forgearc-ai` into a private repository that you control.
3. Start PostgreSQL and pgvector with `docker compose up -d`.
4. Copy `.env.example` to `.env` and set `OPENAI_API_KEY` or AWS credentials.
5. Run `uv sync --all-packages --frozen`.
6. Run `uv run --package forgearc-ai-api alembic -c migrations/alembic.ini upgrade head`.
7. Start with `uv run --package forgearc-ai-api uvicorn forgearc_ai_api.app:app --port 4020`.
8. Log in, upload one document, and call `POST /api/ai/chat/stream`.
9. Synthesize AWS with `cd infra/cdk && pnpm dlx aws-cdk@2 synth AiStack-dev`.

Production startup fails closed when a selected provider credential is missing. Pin Jev to a version such as `jev-1.13.0`; do not use `jev-latest`.
