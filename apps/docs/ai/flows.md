# Chat, ingest, and jobs

These sequences are the ForgeArc AI request path. The stream route writes model tokens as server-sent events, then sends citations and the usage row. If the budget is already spent, the API returns 429 and does not call the model.

## Buffered chat

<Mermaid chart="sequenceDiagram
  participant Client
  participant API as API_Lambda
  participant Gate as Budget_and_module_gate
  participant DB as PostgreSQL
  participant Model as Bedrock_or_OpenAI
  Client->>API: POST /api/ai/chat
  API->>Gate: JWT module ai, permission, remaining budget
  Gate->>DB: load recent turns and matching chunks
  API->>Model: prompt plus citations context
  Model-->>API: reply and token counts
  API->>DB: save turn and usage row
  API-->>Client: reply, citations, token counts" />

The stream route is the same sequence, with the model tokens written as server-sent events. Memory and the usage row are written after the stream finishes. If the budget is already spent, the API returns 429 and does not call the model.

## Document ingestion

<Mermaid chart="sequenceDiagram
  participant Client
  participant API as API_Lambda
  participant Store as S3_or_GCS
  participant Queue as SQS_or_PubSub
  participant Worker
  participant DB as PostgreSQL
  Client->>API: upload document
  API->>Store: save original
  API->>DB: job status queued
  API->>Queue: job id
  API-->>Client: job_id
  Queue->>Worker: deliver
  Worker->>Store: read original
  Worker->>DB: chunks and embeddings for this tenant
  Worker->>DB: job status completed
  Client->>API: GET /api/jobs/job_id
  API-->>Client: completed" />

A failed worker retries with backoff. After three failures the message goes to the DLQ and the job row becomes `failed`. The status route is how the client sees that. An optional webhook is signed so the receiver can reject a forged callback.

## Delete

A delete route removes that tenant's document, chunks, and embeddings, and writes an audit row. It does not delete another tenant's corpus, even if the caller knows the id.
