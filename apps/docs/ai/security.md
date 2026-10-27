# ForgeArc AI security and operations

## Why ForgeArc AI needs durable state

`MemoryRepository` keeps jobs, vectors, conversations, usage, agent runs, approvals, and evaluations in one Python process. After that process restarts, or when the reviewer reaches another replica, the paused approval is gone. Always-on Fargate, ECS, EC2, Cloud Run, or Compute Engine does not fix this: deploys, crashes, health replacement, and extra replicas still drop or split process memory.

Production requires PostgreSQL with pgvector. Aurora Serverless v2 on AWS and AlloyDB on GCP. Approval updates lock the row and apply once. Every query includes `tenant_id`. Secrets are refused in `agent_runs.state_json`. The full decision, including the memory-only failure sequence, is [Durable state](./durable-state).

## Tenant isolation

Documents, chunks, jobs, conversations, usage, agent runs, approvals, evaluations, and audit events carry `tenant_id`. Retrieval includes the tenant predicate before vector ordering. A token from another tenant cannot read job status, a paused run, or corpus content.

## Provider safety

- Models must be explicitly allowlisted.
- Prompt length, rate, budget, moderation, and tools are checked before provider calls.
- Jev uses a pinned model and marks answers below the confidence threshold for review.
- Provider errors fail closed; production never falls back to fake output.

## Agent safety

- Agents only use tools on `tool_allowlist` that have a built-in implementation. Unknown tools are rejected before any model call.
- Tools in `agents.approval_tools` pause the run until a reviewer with `ai:approve` decides. Rejected calls never execute.
- By default the reviewer must be a different person from the requester.
- Each tool runs at most once per run, and `max_steps` and `max_delegations` bound every graph, so a model cannot loop forever.
- Budget is checked again before an approved run resumes.
- The paused graph is stored in PostgreSQL, not in the API process. A second reviewer cannot run the tool twice. See [Durable state](./durable-state).

## Identity

Production identity is OIDC.

| Cloud | Issuer | What the app checks |
| --- | --- | --- |
| AWS | Cognito user pool. API Gateway JWT authorizer. Groups map to permissions, plus a tenant claim. | Issuer, audience, expiry, tenant, module, and permission on every request. |
| GCP | Identity Platform, with the same claim mapping. | The application verifies the JWKS itself, then the same claims. |

`auth.mode: local` and HMAC tokens exist for local and test only. Production rejects local users, HMAC auth, a memory repository, permissive CORS, and a missing issuer or `DATABASE_URL`. HTTPS only. Workloads stay on private networks. AWS encryption is KMS. GCP can use CMEK for Storage, Pub/Sub, and Secret Manager. Document buckets block public access. Secrets rotate in Secrets Manager or Secret Manager. Request and upload sizes stay capped.

## Logging

Audit records store actor, action, resource, prompt hash, and character count—not raw prompts or provider credentials. Redaction helpers remove common email, phone, and secret forms from operational logs.

## Ingestion reliability

SQS retries an ingestion job three times before its dead-letter queue. A CloudWatch alarm publishes to SNS when a job reaches the DLQ. On GCP, Pub/Sub delivers to the dead-letter topic after five attempts, and the worker still marks the job dead after three application attempts. Signed webhooks report completed or dead jobs.

## Incident checklist

1. Pause the affected model or tenant budget.
2. Inspect DLQ count, 5xx, latency, unhealthy tasks or instance count, database connections, job attempts, and audit metadata.
3. Roll the API back to the previous image or revision if the failure started with a deploy. See [AWS deployment](./deploy) or [GCP deployment](./deploy-gcp).
4. Rotate the Secrets Manager or Secret Manager value if credentials may be exposed, then recycle tasks so the old value is gone.
5. Delete affected corpora using the tenant-authenticated API.
6. If an approval or job disappeared after a restart, restore Aurora or AlloyDB from backup and resume against the restored `DATABASE_URL`. Process memory is not a backup.
7. Re-run the gated staging smoke test before restoring traffic.
