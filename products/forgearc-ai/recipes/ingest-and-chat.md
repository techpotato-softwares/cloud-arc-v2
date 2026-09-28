# Ingest and chat

1. Start the API on port 4020.
2. Log in and keep the bearer token.
3. Upload `notes.md` with `corpusId` and `idempotencyKey`.
4. Read `GET /api/jobs/{jobId}` until `status` is `completed`.
5. Call `POST /api/ai/chat/stream` with a question that uses words from the document.
6. Read `GET /api/usage` and confirm `costUsd` increased for the tenant.
