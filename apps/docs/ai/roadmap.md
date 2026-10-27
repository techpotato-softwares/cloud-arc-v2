# ForgeArc AI shipped scope and roadmap

## Shipped in ForgeArc AI

- OpenAI local provider, Amazon Bedrock, and Vertex AI
- GCP adapter for Cloud Storage, Pub/Sub, Firestore, Secret Manager, and AlloyDB Terraform
- Buffered and SSE chat with structured output
- PDF, DOCX, HTML, and Markdown ingestion
- Tenant-scoped chunks, pgvector migration, citations, and corpus deletion
- SQS worker retries, DLQ alarm, idempotent jobs, and signed webhooks
- Token/cost ledger, budget and rate gates, moderation, tool allowlists, and PII-safe audit fields
- TypeSafe AI Jev Choice, Score, and Boolean decisions with pinned versions and review thresholds

- Cost dashboard API and page with spend by model, feature, and day, and a month-end projection

## Shipped in ForgeArc AI Pro

- Tool-calling agents on a state graph that also compiles to LangGraph
- Human-approval APIs for risky tool calls, with separate reviewers by default
- Multi-agent supervisor that pauses and resumes with approvals
- RAG evaluation with RAGAS metric names, a native offline engine, and an optional RAGAS engine

## Production deployment

The operator guides are [Production runtimes](./production), [Durable state](./durable-state), [Portable container](./container), [AWS deployment](./deploy), and [GCP deployment](./deploy-gcp).

- AWS compute is Lambda (scale to zero) or ECS Fargate (always on), selected with CDK context `runtime=lambda` or `runtime=fargate`.
- GCP compute is Cloud Run serverless (`min_instance_count = 0`) or always-on (minimum instances and CPU always allocated), selected with Terraform `runtime_mode=serverless` or `runtime_mode=always_on`.
- Every mode requires PostgreSQL with pgvector: Aurora Serverless v2 or AlloyDB. Process memory is local and test only.
- The same image runs on ECS on EC2, EKS, GKE, Compute Engine, and Docker. This repository does not provision those platforms.
- Production identity is Cognito on AWS and Identity Platform on GCP.
- Migrations, backup and restore, secret rotation, scaling, and incidents are in the two deployment guides.

## Not included

- Voice, copilots, deep agents, subscriptions, and custom commercial adapters

The next product work stays inside ForgeArc AI. [Strategy](./strategy) records the verdict against an LLM gateway, a tool catalog, and an evals platform, and the phase order for deepening those inside this product.

## Plans

| Plan | Includes |
| --- | --- |
| ForgeArc AI | Chat, RAG, Jev decisions, AWS and GCP adapters, cost dashboard |
| ForgeArc AI Pro | Everything in ForgeArc AI plus agents, approvals, supervisor, and evaluation |
| ForgeArc Suite | ForgeArc Node, ForgeArc Python, and ForgeArc AI Pro |

Prices are on the pricing page, which reads the checkout catalog. All plans are one-time source licenses for one organization, with 12 months of updates. Contact us for client-work or team licenses.
