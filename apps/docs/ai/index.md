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
| Cost dashboard | `GET /api/usage/dashboard` and the `/dashboard` page break spend down by model, feature, and day |
| Agents (Pro) | Tool-calling agents and a multi-agent supervisor on a LangGraph-compatible graph |
| Approvals (Pro) | Risky tool calls wait for a second person to approve or reject them |
| Evaluation (Pro) | `POST /api/evaluations` scores RAG quality with RAGAS metric names |
| Caching | TTL, write invalidation, and stampede mutex for read-heavy helpers; PostgreSQL stays the source of truth |

OpenAI is the local provider. Amazon Bedrock is the AWS provider. Vertex AI is the GCP provider. Jev is pinned to a version such as `jev-1.13.0`.

## Where to go

- [Quickstart](./quickstart)
- [AWS and GCP diagrams](./aws-architecture)
- [Chat, ingest, and job flows](./flows)
- [Agents, approvals, and evaluation](./agents)
- [Why ForgeArc AI needs durable state](./durable-state)
- [Caching patterns](./caching) for TTL, invalidation, and stampede mutex
- [Production runtimes](./production) for AWS Lambda or Fargate and GCP Cloud Run serverless or always-on
- [Portable container](./container)
- [AWS deployment](./deploy) and [GCP deployment](./deploy-gcp)
- [Production implementation summary](./production-implementation) for everything shipped in the production-runtimes plan
- [Strategy](./strategy) for how ForgeArc AI lines up with an LLM gateway, tool integration, evals, and guardrails, and the phase plan to deepen them in this product
