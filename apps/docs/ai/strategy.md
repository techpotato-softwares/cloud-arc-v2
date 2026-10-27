# ForgeArc AI strategy

ForgeArc AI is aligned with the “AI picks and shovels” category. It is an integrated AI application backend and control plane. It is not yet a direct replacement for Portkey, Composio, or Maxim.

AWS API Gateway in the architecture is the HTTP entry point. It is not an LLM gateway in the Portkey sense.

The decision for now is to keep one product and evolve it gradually. Do not split gateway, tools, evals, and guardrails into separate products until one of those modules is deep enough to stand alone. That decision is recorded below as an Architecture Decision Record, and each phase states the architecture choice it locks.

## What the category covers

Every serious AI company needs four kinds of infrastructure:

| Need | Reference product | What buyers expect |
| --- | --- | --- |
| LLM gateway and observability | Portkey | One API in front of many models, with routing, fallback, cost, and traces |
| Tool integration | Composio | A catalog of third-party actions, with OAuth and per-user credentials |
| Evals and testing | Maxim AI | Datasets, experiments, judges, and regression history for AI apps |
| Guardrails | Often bundled with the three above | Policy before and after the model: allowlists, PII, injection, budgets, and human approval |

ForgeArc AI already contains a slice of each. Breadth is ahead of depth.

## Verdict

ForgeArc AI is directionally correct. The current implementation supports a source-owned, deployable control plane for governed RAG and agent applications on AWS or GCP.

The strongest positioning is:

> A source-owned, deployable AI application control plane for building governed RAG and agent applications on AWS or GCP.

The differentiator is not “more connectors than Composio” or “richer analytics than Maxim.” The differentiator is:

- One deployable stack.
- Customer-owned cloud and data.
- Multi-tenant production architecture.
- Durable agent state.
- Human approval and auditability.
- Model, retrieval, cost, evals, and tools under one policy layer.
- Source ownership under the ForgeArc license.

That is a coherent product. The work below deepens the four categories inside that product instead of starting a second one.

## Alignment today

Percentages are a planning estimate against the reference products, not a score of product quality.

### LLM gateway — about 30%

Already present:

- A common `ModelProvider` interface for `complete`, `stream`, and `embed`.
- OpenAI, Amazon Bedrock, and Vertex AI adapters.
- Model allowlists.
- Token and cost accounting, plus a tenant budget.
- Streaming and structured output.

Missing compared with Portkey:

- An OpenAI-compatible universal gateway API.
- Runtime routing across providers and models.
- Automatic retries, fallback, and load balancing.
- Per-request latency and error traces.
- Prompt and version tracking.
- Rate limits and budgets that hold across replicas.
- Provider-agnostic API keys and virtual keys.

Today one provider and model are selected in deployment configuration. That is provider abstraction. It is not yet a gateway. The selection lives in `packages/core/src/forgearc_ai/config.py` and the adapters behind `ModelProvider`.

### Tool integration — about 15%

Already present:

- A tool-calling agent runtime.
- A tool allowlist.
- Human approval for risky actions.
- Durable pause and resume across processes.
- A multi-agent supervisor.
- Optional compilation of the same graph to LangGraph.

The built-in tools are `retrieve_documents`, `list_documents`, and `notify_webhook`.

Missing compared with Composio:

- A large connector catalog.
- OAuth lifecycle and user-level connected accounts.
- Dynamic action and tool discovery.
- A standard tool schema that outside code can register.
- MCP support.
- A credential vault and permission scope per connection.

ForgeArc has an agent execution foundation. Composio’s depth is the integration and authentication catalog. ForgeArc should not try to rebuild that catalog.

### Evals — about 30%

Already present:

- `POST /api/evaluations` for a batch of question-and-answer samples.
- Faithfulness, answer relevancy, context precision, and context recall.
- Thresholds that can fail a CI job.
- A deterministic native engine and an optional RAGAS engine.
- Stored evaluation history.

Missing compared with Maxim:

- Dataset management.
- Prompt and model experiment comparison.
- Prompt versioning.
- Human annotation.
- Online evaluation of production traffic.
- A configurable LLM-as-judge.
- Regression history across releases.
- Traces that connect the input, retrieval, tools, and output.

The native engine is a deterministic RAG regression gate. It is not an LLM judge. See [Agents, approvals, and evaluation](./agents).

### Guardrails — about 40%

This is the strongest of the four today.

Already present:

- Prompt-size limits.
- A moderation term list.
- Model and tool allowlists.
- Tenant isolation on documents, chunks, jobs, runs, and approvals.
- Budget and rate gates.
- Human approval, with a different reviewer by default.
- `max_steps` and `max_delegations` so a model cannot loop without bound.
- Audit records that store a prompt hash, not the prompt text.
- Durable, exactly-once approval handling in PostgreSQL.

The moderation check is substring matching. The rate and budget counters in `PolicyGate` live in process memory, so they reset when a process restarts and they do not add up across replicas. Production guardrails need a shared store and checks on both the input and the output.

## ADR: One ForgeArc AI product, deepened in phases

Architecture decision record for how ForgeArc AI grows toward an LLM gateway, tool integration, evals, and guardrails. Status: accepted. Date: 2026-10-18.

The durable-state ADR in [Why ForgeArc AI needs durable state](./durable-state) still stands. This record does not reopen it. Phase 0 depends on that decision: production state stays in PostgreSQL, and process memory stays local and test only.

### Context

ForgeArc AI already ships chat, retrieval, typed decisions, a cost ledger, tool-calling agents, human approvals, and a RAG evaluation API. Those pieces sit in one deployable product on AWS and GCP.

The surrounding market sells the same needs as separate products: Portkey for the gateway and traces, Composio for tool connections, and Maxim for evals. Guardrails show up inside all three. A team buying ForgeArc will expect those capabilities. The current product has a slice of each and the depth of none.

Splitting the work into new products now would fork the provider interface, the policy gate, the tenant store, and the approval flow before any one of those forks is deep enough to sell on its own.

### Decision

Keep one ForgeArc AI product at `products/forgearc-ai`. Deepen it in the phases in this document. Inside that product, the next work is modules that share the provider interface, the policy gate, the tenant store, and the approval flow:

### Modules

| Module | Grows from |
| --- | --- |
| ForgeArc Gateway | `ModelProvider`, provider adapters, cost ledger |
| ForgeArc Agents | `AgentService`, the state graph, approvals |
| ForgeArc Tools | The three built-in tools and `tool_allowlist` |
| ForgeArc Evals | `EvaluationService` and the RAGAS metric names |
| ForgeArc Guardrails and observability | `PolicyGate`, audits, usage, and the cost dashboard |

Selling or deploying a module on its own can wait until that module is deep enough to be the reason someone buys. Three separate products now would split the same engineering effort before any module matches Portkey, Composio, or Maxim.

Where another product already owns the ecosystem, integrate it:

- Portkey can be an optional upstream gateway.
- Composio and MCP can be tool providers behind the ForgeArc tool registry.
- Traces and evaluation rows can be exported to Maxim, Langfuse, or OpenTelemetry.
- Native ForgeArc behavior stays available for self-hosted and basic use.

The wedge to deepen first is governed production agent infrastructure: durable approvals, tenant isolation, and customer-owned deployment. A generic LLM gateway alone is a weaker wedge.

### Alternatives considered

| Alternative | Why it was rejected |
| --- | --- |
| Ship ForgeArc Gateway, ForgeArc Tools, and ForgeArc Evals as separate products now | Each product would reimplement tenancy, policy, cost, and deployment. None is deep enough yet to be the reason someone buys. |
| Stop at the current agents and RAG gate | The product would keep the control-plane shape and leave the gateway, tool catalog, eval history, and production guardrails unmet. |
| Adopt Portkey, Composio, and Maxim as the only implementation | That drops the source-owned, customer-cloud deployment that ForgeArc sells. Those products stay optional integrations, not the core. |
| Build a connector catalog, an eval studio, and a hosted gateway in one release | The catalog and the studio are the moat of other companies. One release would widen the product without making approvals, traces, or shared budgets production-safe. |
| Treat AWS API Gateway as the LLM gateway | API Gateway terminates HTTP and checks JWTs. It does not route models, fall back between providers, or record a model invocation. |

### Consequences

- New gateway, tool, guardrail, and eval code lands in `products/forgearc-ai` and is documented under `apps/docs/ai`.
- A phase starts only after the previous phase’s exit criteria hold on AWS and GCP with the same API.
- Before implementation of a phase, this page already states that phase’s architecture choice. A change to that choice is an update to this ADR, not a silent code change.
- Optional integrations (Portkey, Composio, MCP, Maxim, Langfuse, OpenTelemetry) sit behind ForgeArc interfaces. The native path keeps working when they are absent.
- Durable approvals, tenant isolation, prompt hashing in audits and traces, and exactly-once tool execution stay in force through every phase. Those rules come from the [durable-state ADR](./durable-state).
- Voice, copilots, deep agents, subscriptions, and custom commercial adapters stay out of this cycle. See [Shipped scope and roadmap](./roadmap).

## Phase plan

Each phase ships inside `products/forgearc-ai` and the docs under `apps/docs/ai`. A phase is done when its exit criteria hold on AWS and GCP with the same API. Later phases assume the earlier ones, and none of them require a new product.

Each phase below is a phase-level decision under the ADR above. Status for Phase 0 is accepted and shipped. Status for Phases 1 through 5 is accepted as the plan, and implementation has not started. Changing a phase decision means editing that phase in this document before the code changes.

<Mermaid chart="flowchart LR
  p0[Phase 0 baseline] --> p1[Phase 1 traces]
  p1 --> p2[Phase 2 gateway]
  p2 --> p3[Phase 3 tools]
  p3 --> p4[Phase 4 guardrails]
  p4 --> p5[Phase 5 evals]" />

### Phase 0 — Baseline, already shipped

Decision: keep the shipped control plane as the base. Persistence stays the accepted [durable-state ADR](./durable-state): PostgreSQL with pgvector in production, `MemoryRepository` for local and test. Rejected for this phase: rebuilding chat, agents, or evals before traces exist.

This is the starting point. Do not rebuild it.

- Chat, streaming, documents, tenant-scoped retrieval, and Jev decisions.
- OpenAI locally, Bedrock on AWS, Vertex AI on GCP.
- Cost ledger and `/dashboard`.
- Tool-calling agents, supervisor, human approvals, and durable `agent_runs` state.
- Native and optional RAGAS evaluation.
- Lambda or Fargate on AWS, Cloud Run serverless or always-on on GCP, with Aurora or AlloyDB.

Exit criteria: already met by the current ForgeArc AI and ForgeArc AI Pro scope in [Shipped scope and roadmap](./roadmap).

### Phase 1 — One trace for every invocation

Decision: store one invocation row in PostgreSQL per chat, decision, agent step, supervisor delegation, and evaluation. The row stores hashes and lengths, and it links retrieval and tool steps. Rejected: log-only tracing, a separate trace database, and storing prompt text on the trace.

Build on the usage ledger, audit rows, agent `trace`, and the cost dashboard.

Deliver:

- An invocation record for chat, decisions, agent steps, supervisor delegations, and evaluations.
- Fields for tenant, feature, model, token counts, cost, latency, status, and error class.
- Retrieval and tool steps attached to the same invocation.
- Dashboard lists for recent invocations, not only month-to-date spend.
- An export shape that a later OpenTelemetry or Langfuse sink can consume. The sink itself can wait.

Leave for later: provider routing, new tools, and a full eval studio.

Exit criteria:

- A chat, an agent run, and an evaluation each produce one queryable trace.
- The trace survives a new process because it is in PostgreSQL.
- Logs still omit prompt text. The trace stores hashes and lengths the same way audits do today.

### Phase 2 — Gateway behavior on the existing provider interface

Decision: add gateway behavior on `ModelProvider` and an OpenAI-compatible route beside the current chat routes. Routes are ordered allowlisted models with timeout, retry, and fallback. Tenant budgets and rate limits move to PostgreSQL. Rejected: treating AWS API Gateway as the model router, and retrying a policy rejection.

Build on `ModelProvider` and the OpenAI, Bedrock, and Vertex adapters.

Deliver:

- An OpenAI-compatible route for chat completions, beside the existing `/api/ai/chat` routes.
- A route config: ordered providers and models, timeouts, retry count, and fallback.
- Retries only for retryable provider errors. A policy rejection is not retried.
- Fallback to the next allowlisted model when the primary fails or times out.
- Budgets and rate limits stored per tenant in PostgreSQL, shared by every replica. `PolicyGate` stops being the only counter.
- Virtual keys later, only after the shared limits exist. A virtual key is a ForgeArc credential that maps to a tenant and a route, not a copy of the upstream provider key.

Leave for later: a hosted multi-tenant control plane for people who do not deploy ForgeArc, and a full prompt-management UI.

Exit criteria:

- One config can prefer Bedrock and fall back to another allowlisted model.
- Two API replicas enforce one tenant budget.
- Existing chat, agent, and decision calls record cost on the same ledger.

### Phase 3 — A tool registry, then other people’s tools

Decision: register tools behind one schema, allowlist, and approval gate, then attach MCP and an optional Composio adapter to that registry. ForgeArc stores the grant. The external system stores OAuth credentials. Rejected: a ForgeArc-owned connector catalog, and tools that skip approval or run more than once.

Build on `tool_allowlist`, `agents.approval_tools`, and the durable approval flow.

Deliver:

- A tool registry: name, description, JSON input schema, whether approval is required, and a handler.
- The three current tools registered through that registry. Behavior of `retrieve_documents`, `list_documents`, and `notify_webhook` stays the same.
- A small SDK so product code can add a tool without editing the agent graph.
- MCP as the first external provider. Discovered MCP tools pass through the same allowlist and approval gate.
- Composio as an optional adapter that turns a connected action into a registry tool. ForgeArc stores the grant decision. Composio stores the third-party OAuth credential.

Leave for later: a ForgeArc-built catalog of hundreds of SaaS connectors.

Exit criteria:

- A custom tool and an MCP tool can be allowlisted, can pause for approval, and run at most once per run.
- A rejected approval still never executes.
- Unknown tools still fail before any model call.

### Phase 4 — Guardrails that hold in production

Decision: run input and output policy on the shared gateway path, with per-tenant redact-or-block for PII, an injection check on retrieved context, and schema checks on tool arguments before approval. Rejected: process-local rate and budget counters, and a separate guardrail product.

Build on `PolicyGate`, the moderation list, the audit hash, and the approval tools.

Deliver:

- Input and output checks on chat, agents, and the gateway route.
- PII detection with a redact-or-block action per tenant.
- A prompt-injection check on retrieved context before it is sent to the model.
- Validation of tool arguments against the tool schema before approval or execution.
- Per-tenant policy: moderation terms, PII action, injection action, and which tools may run.
- Shared rate and budget enforcement from Phase 2 remain the limit that blocks the call.

Leave for later: a marketplace of third-party guardrail models, and custom classifier training.

Exit criteria:

- A blocked prompt never reaches the provider.
- A tool call with an invalid argument never reaches approval or execution.
- The same policy result is recorded on the Phase 1 trace.
- Multi-replica budget and rate behavior from Phase 2 still holds.

### Phase 5 — Evals that can gate a release

Decision: keep datasets, immutable prompt versions, and experiments in ForgeArc, with native scoring as the offline default and RAGAS or a pinned LLM judge as optional engines. Production sampling is opt-in and stores hashes, not raw prompts. Rejected: a separate hosted eval product, and an annotation studio in this cycle.

Build on `POST /api/evaluations`, stored evaluation rows, and the Phase 1 traces.

Deliver:

- Named datasets of samples, stored per tenant.
- An experiment: dataset, model or prompt version, engine (`native` or `ragas`), thresholds, and the resulting scores.
- Prompt versions referenced by experiments. A version is an immutable id, not an editable blob.
- An optional LLM-judge engine with a pinned model, in addition to native and RAGAS.
- Asynchronous evaluation jobs so a large dataset does not hold an HTTP request open.
- A CI command that runs a dataset and exits non-zero when `passed` is false.
- Sampling of production traces into a dataset. Sampling is opt-in per tenant.

Leave for later: a full annotation studio and a hosted eval product separate from ForgeArc AI.

Exit criteria:

- Two experiments on the same dataset show scores side by side.
- CI can run the native engine without provider credentials beyond embeddings.
- A sampled production trace can be added to a dataset without copying the raw prompt into logs.

## What this cycle does not do

- A separate gateway, tools, or evals product.
- A connector catalog owned by ForgeArc.
- Replacing Portkey, Composio, or Maxim for teams that already standardized on them. Those stay optional integrations.
- Voice, copilots, deep agents, subscriptions, and custom commercial adapters. Those remain out of scope in [Shipped scope and roadmap](./roadmap).

## How to use this plan

Pick up the next phase only after the previous phase’s exit criteria are true in the repo and in the docs. Phase 1 is the next increment. It makes the later gateway, tool, guardrail, and eval work observable without changing the product boundary.

The ADR at the top of this page is the product decision. The decision line on each phase is the architecture record for that increment. Update the phase decision first when the approach changes, then implement it.
