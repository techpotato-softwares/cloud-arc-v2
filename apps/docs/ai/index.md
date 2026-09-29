# ForgeArc AI

ForgeArc AI is a separate Python product at `products/forgearc-ai`. It keeps the ForgeArc shape: FastAPI locally, Python CDK on AWS, decorator routes, a generated manifest, and Alembic. The new code is a provider-agnostic core plus an AWS adapter.

## What this release does

| Capability | Behavior |
| --- | --- |
| Chat | `POST /api/ai/chat` returns a model reply. Missing production credentials fail startup |
| Streaming | `POST /api/ai/chat/stream` sends the reply as server-sent events, then citations and token cost |
| Documents | Upload to memory, S3, or Cloud Storage, enqueue ingestion, and poll job status |
| Retrieval | Chunk, embed, and return citations. Search is always filtered by `tenant_id` |
| Decisions | `POST /api/decisions/evaluate` calls TypeSafe AI Jev for Choice, Score, and Boolean answers |
| Cost | Each call records model, token counts, and tenant id against a budget |
| Isolation | Every document, chunk, and job row carries `tenant_id` |

OpenAI is the local provider. Amazon Bedrock is the AWS provider. Vertex AI is the GCP provider. Jev is pinned to a version such as `jev-1.13.0`.

## Where to go

- [Quickstart](./quickstart)
- [AWS and GCP diagrams](./aws-architecture)
- [Chat, ingest, and job flows](./flows)
