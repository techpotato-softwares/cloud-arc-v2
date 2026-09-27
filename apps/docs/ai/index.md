# ForgeArc AI

ForgeArc AI is the next kit. It is not a folder in this repository yet, and its checkout is closed. This section is the design the kit will follow, written so Node and Python buyers can see where it attaches.

It keeps the Python kit's shape: FastAPI locally, Python CDK on AWS, decorator routes, `define_lambda`, SQLAlchemy, and Alembic. The new code is a provider-agnostic core plus an AWS adapter.

## What the first release does

| Capability | Behavior |
| --- | --- |
| Chat | `POST` a message and receive a model reply. Missing credentials fail startup. They do not fall back to a stub |
| Streaming | A second route sends the reply as server-sent events |
| Documents | Upload to object storage, enqueue ingestion, poll job status |
| Retrieval | Chunk, embed, store in pgvector locally, and return citations with the answer |
| Cost | Each call records model, token counts, and tenant id against a budget |
| Isolation | Every document, chunk, and job row carries `tenant_id` |

OpenAI is the local provider. Amazon Bedrock is the AWS provider. GCP (Vertex AI, Cloud Storage, Pub/Sub, AlloyDB) is a later adapter behind the same interfaces.

## What it replaces

Today both kits expose `POST /api/ai/chat` as a stub. ForgeArc AI replaces that module. It does not replace platform auth. Buyers still log in with the platform JWT and call AI routes with `ai:*` permissions.

## Where to go

- [Planned quickstart](./quickstart)
- [AWS and GCP diagrams](./aws-architecture)
- [Chat, ingest, and job flows](./flows)
