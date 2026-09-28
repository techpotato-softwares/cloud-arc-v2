# ForgeArc AI configuration

`products/forgearc-ai/forgearc-ai.yaml` is the typed source of truth. Environment variables supply secrets; they do not replace product configuration.

## Provider selection

- `chat.provider`: `openai`, `bedrock`, or `fake` in tests.
- `chat.model` and `embeddings.model`: must appear in their allowlists.
- `documents_provider`: memory locally or S3 through the AWS adapter.
- `jobs_provider`: inline locally or SQS through the AWS adapter.
- `jev.model`: pin a concrete version such as `jev-1.13.0`.

Production rejects fake providers, local users, missing JWT/provider credentials, and moving Jev aliases such as `jev-latest`.

## Controls

`limits` caps prompt size, request rate, and ingestion attempts. `budget.monthly_usd` blocks model calls once exhausted. `moderation_terms` and `tool_allowlist` provide deterministic application gates before any provider call.

## Secrets

Local values come from `.env`. AWS values live in Secrets Manager and are read by a role limited to the configured secret. Bedrock uses IAM rather than an API key.
