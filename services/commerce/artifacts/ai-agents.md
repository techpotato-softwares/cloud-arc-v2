# ForgeArc AI Pro: agents, approvals, and evaluation

This file confirms the ForgeArc AI Pro entitlement. The agent module ships in the same private repository as ForgeArc AI.

1. Complete the ForgeArc AI setup guide first.
2. Add the approval permission to an operator: `ai:approve`. Agent callers need `ai:agent`; evaluation and the dashboard need `ai:read`.
3. Run an agent with `POST /api/agents/run` and a `message`. The run returns `completed` or `awaiting_approval`.
4. Review pending tool calls with `GET /api/approvals`, then call `POST /api/approvals/{approvalId}` with `{"decision": "approve"}` or `{"decision": "reject"}`.
5. Route a request across agents with `POST /api/agents/supervise`.
6. Score retrieval quality with `POST /api/evaluations` and a list of question, answer, and context samples.
7. Read spend by model, feature, and day from `GET /api/usage/dashboard`.
8. Optional: install `uv sync --extra langgraph --extra ragas` to compile the same graph with LangGraph and to score with RAGAS.
