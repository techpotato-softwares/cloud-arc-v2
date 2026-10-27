# ForgeArc AI API

All protected routes require a ForgeArc JWT with the `ai` module and the listed permission.

| Route | Permission | Purpose |
| --- | --- | --- |
| `POST /api/auth/login` | Public local route | Obtain a development token |
| `POST /api/ai/chat` | `ai:chat` | Buffered answer, citations, and usage |
| `POST /api/ai/chat/stream` | `ai:chat` | SSE deltas followed by citations and usage |
| `POST /api/documents` | `ai:ingest` | Upload and enqueue a tenant-scoped document |
| `GET /api/jobs/{job_id}` | `ai:read` | Read ingestion state and retry count |
| `POST /api/retrieval` | `ai:read` | Search tenant-scoped chunks |
| `DELETE /api/corpora/{corpus_id}` | `ai:delete` | Delete a tenant corpus and its chunks |
| `GET /api/usage` | `ai:read` | Read token and cost totals |
| `POST /api/decisions/evaluate` | `ai:decide` | Run pinned Jev Choice, Score, or Boolean decisions |
| `GET /api/usage/dashboard` | `ai:read` | Spend by model, feature, and day, plus budget projection |
| `POST /api/agents/run` | `ai:agent` | Run a tool-calling agent (AI Pro) |
| `POST /api/agents/supervise` | `ai:agent` | Run the multi-agent supervisor (AI Pro) |
| `GET /api/agents/runs/{run_id}` | `ai:read` | Read an agent or supervisor run |
| `GET /api/approvals` | `ai:read` | List pending tool calls; `?status=all` shows history |
| `POST /api/approvals/{approval_id}` | `ai:approve` | Approve or reject a tool call and resume the run |
| `POST /api/evaluations` | `ai:evaluate` | Score RAG samples with RAGAS metric names |
| `GET /api/evaluations` | `ai:read` | List past evaluation results |

`GET /dashboard` serves a built-in cost and approval page that calls these routes with the signed-in user's token. See [Agents, approvals, and evaluation](./agents).

## Streaming completion

The final SSE event has `done: true` and includes citations and token cost. Persist the final event before closing the UI stream.

## Idempotency

Document uploads accept an `idempotencyKey`. Retrying the same tenant/key returns the existing job instead of creating duplicate chunks.
