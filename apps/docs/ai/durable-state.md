# Durable state

Architecture decision record for ForgeArc AI production persistence. Status: accepted.

## Why ForgeArc AI needs durable state

`MemoryRepository` keeps jobs, vectors, conversations, usage, agent runs, approvals, and evaluations inside one Python process. That is enough for local runs and tests. It is not enough for a reviewer who arrives after the process that paused the agent is gone.

Production therefore requires PostgreSQL with pgvector on every runtime. Aurora Serverless v2 fills that role on AWS. AlloyDB fills it on GCP. The application uses the same repository contract for both.

## The memory-only approval failure

`MemoryRepository` stores those records in process dictionaries: `jobs`, `chunks`, `memory` (conversation turns), `usage`, `agent_runs`, `approvals`, and `evaluations`. Nothing in that object is written to a database.

This is the failure, in order:

1. A caller with `ai:agent` starts a run, for example `POST /api/agents/run` with the `notify_webhook` tool.
2. The tool is listed in `agents.approval_tools`, so the graph stops. The run status becomes `awaiting_approval`. The approval row and the full graph state exist only in that process.
3. The API process then disappears or stops being the process that receives the next request. A Lambda execution environment is frozen and later replaced. A container is redeployed, crashes, fails a health check, or scales out.
4. A reviewer calls `GET /api/approvals` or `POST /api/approvals/{approvalId}` with `{"decision":"approve"}`. The platform routes that request to a different process.
5. The new process builds its own `MemoryRepository`. `get_approval` returns nothing, so the API responds `Approval not found.` If the approval id were known but the run dictionary were empty, the follow-up lookup responds `Run not found.`
6. The tool never runs, and the reviewer has no paused run to resume. A second replica can also decide it never saw the approval and start a duplicate path if the first process is still alive.

The same loss hits ingestion jobs, conversation turns, the cost ledger, and evaluation rows. Approvals are the sharp case because a person is waiting on a record that only one process held.

<Mermaid chart="sequenceDiagram
  participant User
  participant A as Process_A
  participant MemA as MemoryRepository_A
  participant Reviewer
  participant B as Process_B
  participant MemB as MemoryRepository_B
  User->>A: POST /api/agents/run
  A->>MemA: save run awaiting_approval and approval
  Note over A,MemA: Lambda or container restarts, scales, or is replaced
  Reviewer->>B: POST /api/approvals/id
  B->>MemB: get_approval
  MemB-->>B: missing
  B-->>Reviewer: Approval not found" />

## Always-on compute still loses the run

An always-on ECS service, Fargate service, EC2 instance, Cloud Run service with minimum instances, or Compute Engine VM keeps a process running. It does not keep that process's memory across the events that production actually hits.

| Event | What happens to process memory |
| --- | --- |
| Deploy or rollback | The old task is drained and killed. The new task starts empty. |
| Crash, out-of-memory kill, or failed health check | The orchestrator replaces the task. The replacement starts empty. |
| Autoscale | A new replica has an empty `MemoryRepository`. The approval is still only in the replica that paused. |
| Scale-in | The replica that holds the approval can be the one that stops. |
| More than one replica | Two reviewers, or a retry, can land on different processes and see different dictionaries. |

Sticky sessions only prefer one instance for one client connection. They do not put the approval into the reviewer's process after the original process is gone, and they do not coordinate two reviewers. Local disk and a memory volume disappear with the task unless every replica mounts the same durable store and locks it. At that point the system is a database with extra steps.

Lambda scale-to-zero and Cloud Run scale-to-zero make the gap obvious. Fargate and always-on Cloud Run hide it until the first deploy. Every mode still needs the database. See [Production runtimes](./production).

## Why PostgreSQL and pgvector

PostgreSQL with the pgvector extension is the production store for four reasons:

- The schema is already SQLAlchemy models and Alembic migrations in `products/forgearc-ai`. Documents, chunks, jobs, conversation messages, usage, audits, `agent_runs`, approvals, evaluations, and webhook events are tables, not a second storage API.
- Transactional approval state and vector embeddings live in one database. A chunk write and a job status update commit together. Retrieval filters `tenant_id` before vector ordering. The initial migration enables `vector` and adds `chunks.embedding_vec`.
- Approval decisions can be exactly once. `decide_approval` locks the approval row with `SELECT … FOR UPDATE` and updates it only while `status` is `pending`. A second reviewer gets no row to decide. `agent_runs.version` is checked when `state_json` is saved, so a stale writer must reload instead of overwriting a newer graph. The approvals table also has a uniqueness constraint on run, tool, and status.
- Both clouds have a managed PostgreSQL that runs this schema. AWS uses Aurora Serverless v2 with pgvector behind RDS Proxy. GCP uses AlloyDB with pgvector over Direct VPC egress. `PostgresRepository` is selected by `DATABASE_URL` and is the same code path for both.

`state_json` on `agent_runs` stores the versioned graph, including the paused step, so a new process can resume after a restart. Secrets are stripped before that JSON is written. Keys such as `api_key`, `authorization`, `password`, `secret`, and `token` are rejected.

`MemoryRepository` stays for `environment` `local` and `test`. Production startup already fails when `DATABASE_URL` is missing, with the error `DATABASE_URL is required in production; in-memory state is not durable.`

<Mermaid chart="sequenceDiagram
  participant User
  participant A as Process_A
  participant DB as PostgreSQL
  participant Reviewer
  participant B as Process_B
  User->>A: POST /api/agents/run
  A->>DB: commit agent_runs.state_json and approvals
  Note over A: process exits on restart or scale
  Reviewer->>B: POST /api/approvals/id
  B->>DB: lock approval row and check version
  DB-->>B: one pending row updated
  B->>DB: resume graph from state_json
  B-->>Reviewer: run resumed and tool ran once" />

## Alternatives considered

| Alternative | Why it was rejected |
| --- | --- |
| In-memory only | The approval failure above. A restarted process cannot see the run. |
| Sticky sessions | The session ends when the task is replaced. A second reviewer is not the same session. Two replicas still disagree. |
| Local disk or EFS | A single instance disk dies with the task. A shared file system still needs locking, migrations, and backups, and it is a poor fit for tenant-scoped vector search. |
| DynamoDB plus a separate vector database | Approvals and embeddings would commit in two systems. A crash between them leaves a paused run without its chunks, or chunks without the approval. Row locks and the existing Alembic schema would be rewritten. |
| Rebuild state from the queue only | The queue message is an ingestion job, not the agent graph. After the message is deleted, a paused approval has nowhere to resume from. Replaying the queue can also run a tool twice. |

## Runtime rules

- `MemoryRepository` is for local development and tests. Production uses `PostgresRepository` through `DATABASE_URL`.
- Production refuses to start without that database URL.
- Every read and write is scoped by `tenant_id`. A token for another tenant cannot load the run, the approval, the job, or the chunks.
- Approval updates are transactional and idempotent. One pending approval is decided once. The graph version must match before `state_json` is replaced.
- Secrets never enter `state_json`.
- API replicas do not run Alembic on startup. Migrations are a one-off job before rollout. See [AWS deployment](./deploy) and [GCP deployment](./deploy-gcp).

## Cost and operations

The database is a standing cost in both serverless and always-on modes. Lambda or Cloud Run scale-to-zero removes idle compute. It does not remove Aurora or AlloyDB.

| Topic | What to plan for |
| --- | --- |
| Database cost | Aurora Serverless v2 bills ACUs, storage, and I/O, with a minimum ACU while the cluster exists. AlloyDB bills the primary instance and storage. Both are required in production, including when API compute is at zero. |
| Backups | Automated backups and point-in-time recovery. Production Aurora uses deletion protection. AlloyDB backups stay enabled. Restore to a new endpoint, then update the secret. Do not restore over the only copy. |
| Migrations | One Alembic job on the new image, then API and worker rollout. A failed migration stops the rollout. Downgrade only when the revision is reversible; otherwise restore a backup. |
| Connection pooling | AWS puts RDS Proxy between Lambda or Fargate and Aurora. On Cloud Run, keep each instance's pool small, because every new instance multiplies connections. |
| Capacity | Set an Aurora minimum ACU high enough for approval traffic after idle periods. Serverless v2 scales capacity down; it does not replace the cluster with process memory. Size AlloyDB for connections from the maximum instance count. |
| Recovery | Expect to recover by restoring the database and starting new compute against it. Process memory is not part of the recovery point. Paused approvals must still be in `approvals` and `agent_runs` after the restore. |

## Acceptance evidence

These checks are the bar for this decision:

| Check | Evidence |
| --- | --- |
| Restart and resume | `test_agent_approval_resumes_after_process_restart` in `products/forgearc-ai/apps/api/tests/test_repositories.py`. A run pauses in one app container. A second container, with a new repository object, approves it against the same database and the run completes. |
| Concurrent review | `test_approval_decision_is_atomic` in the same file. Two reviewers decide one approval. One update commits. The row ends `approved` once. |
| Tenant isolation | `test_repository_contract_is_tenant_scoped_and_idempotent` and `test_schema_and_pgvector_query_are_tenant_scoped`. Another tenant's list and vector query do not return the first tenant's rows. Agent routes return the same refusal for a foreign tenant token. |
| Backup and restore | On a staging Aurora or AlloyDB cluster, pause an approval, restore a backup to a new endpoint, point `DATABASE_URL` at it, and resume the approval from a new process. The tool must run once. |

Related pages: [Production runtimes](./production), [Configuration](./configuration), [Security and operations](./security), [Portable container](./container).
