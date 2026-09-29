# ForgeArc AI security and operations

## Tenant isolation

Documents, chunks, jobs, usage, memory, and audit events carry `tenant_id`. Retrieval includes the tenant predicate before vector ordering. A token from another tenant cannot read job status or corpus content.

## Provider safety

- Models must be explicitly allowlisted.
- Prompt length, rate, budget, moderation, and tools are checked before provider calls.
- Jev uses a pinned model and marks answers below the confidence threshold for review.
- Provider errors fail closed; production never falls back to fake output.

## Logging

Audit records store actor, action, resource, prompt hash, and character count—not raw prompts or provider credentials. Redaction helpers remove common email, phone, and secret forms from operational logs.

## Ingestion reliability

SQS retries an ingestion job three times before its dead-letter queue. A CloudWatch alarm publishes to SNS when a job reaches the DLQ. On GCP, Pub/Sub delivers to the dead-letter topic after five attempts, and the worker still marks the job dead after three application attempts. Signed webhooks report completed or dead jobs.

## Incident checklist

1. Pause the affected model or tenant budget.
2. Inspect DLQ count, job attempts, and audit metadata.
3. Rotate the Secrets Manager value if credentials may be exposed.
4. Delete affected corpora using the tenant-authenticated API.
5. Re-run the gated staging smoke test before restoring traffic.
