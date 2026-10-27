from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Callable
from datetime import UTC, datetime

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.contracts import ModelProvider
from forgearc_ai.cost import token_cost
from forgearc_ai.errors import Forbidden, NotFound, PolicyError
from forgearc_ai.graph import END, StateGraph
from forgearc_ai.policy import PolicyGate
from forgearc_ai.repositories import (
    ApprovalRecord,
    AuditRecord,
    Repository,
    UsageRecord,
    sign_webhook,
)
from forgearc_ai.structured import schema_instructions

TOOL_DESCRIPTIONS = {
    "retrieve_documents": "Search the tenant's documents. Input: a search query.",
    "list_documents": "List the tenant's uploaded document names. Input: ignored.",
    "notify_webhook": "Send a signed notification to the configured webhook. Input: the message to send.",
}


class AgentService:
    """Tool-calling agents, human approval of risky tools, and a multi-agent supervisor.

    Run state is a plain dict so a paused run can be stored and resumed by any process.
    """

    def __init__(
        self,
        settings: Settings,
        provider: ModelProvider,
        gate: PolicyGate,
        repository: Repository,
    ):
        self.settings = settings
        self.provider = provider
        self.gate = gate
        self.repository = repository
        self.tools: dict[str, Callable[[dict, str], tuple[str, dict]]] = {
            "retrieve_documents": self._retrieve,
            "list_documents": self._list_documents,
            "notify_webhook": self._notify,
        }
        self.agent_graph = self._build_agent_graph()
        self.supervisor_graph = self._build_supervisor_graph()

    def run(self, principal: Principal, body: dict) -> dict:
        message = _message(body)
        name = body.get("agent") or ""
        profile = self.settings.agents.profiles.get(name) if name else None
        if name and profile is None:
            raise NotFound(f"Agent {name} is not configured.")
        tools = list(body.get("tools") or (profile.tools if profile else self.settings.tool_allowlist))
        if profile is not None:
            outside = [tool for tool in tools if tool not in profile.tools]
            if outside:
                raise PolicyError(f"Agent {name} cannot use: {', '.join(outside)}.")
        self._check_tools(tools)
        self.gate.check_prompt(principal, message, tools)
        state = self._new_state(principal, "agent", name or "assistant", message, profile.description if profile else "")
        state["tools"] = tools
        self._audit(principal, "agent_run", state)
        self.agent_graph.invoke(state)
        self.repository.save_agent_run(state)
        return self._public(state)

    def supervise(self, principal: Principal, body: dict) -> dict:
        message = _message(body)
        profiles = self.settings.agents.profiles
        agents = list(body.get("agents") or profiles)
        unknown = [agent for agent in agents if agent not in profiles]
        if unknown:
            raise NotFound(f"Agents are not configured: {', '.join(unknown)}.")
        tools = sorted({tool for agent in agents for tool in profiles[agent].tools})
        self._check_tools(tools)
        self.gate.check_prompt(principal, message, tools)
        state = self._new_state(principal, "supervisor", "supervisor", message, "")
        state.update({"agents": agents, "visited": [], "delegations": [], "nextAgent": None, "childRunId": None})
        self._audit(principal, "supervisor_run", state)
        self.supervisor_graph.invoke(state)
        self.repository.save_agent_run(state)
        return self._public(state)

    def get_run(self, principal: Principal, run_id: str) -> dict:
        return self._public(self._owned_run(principal, run_id))

    def list_approvals(self, principal: Principal, query: dict) -> dict:
        status = query.get("status") or "pending"
        rows = self.repository.list_approvals(principal.tenant_id, status)
        return {"approvals": [record.public() for record in rows]}

    def decide(self, principal: Principal, approval_id: str, body: dict) -> dict:
        record = self.repository.get_approval(
            principal.tenant_id,
            approval_id,
        )
        if record is None:
            raise NotFound("Approval not found.")
        if record.status != "pending":
            raise PolicyError(f"This approval was already {record.status}.")
        decision = body.get("decision")
        if decision not in ("approve", "reject"):
            raise PolicyError("Decision must be approve or reject.")
        if principal.email == record.requested_by and not self.settings.agents.allow_self_approval:
            raise Forbidden("A different reviewer must decide this tool call.")
        self.gate.check_budget(principal.tenant_id)
        status = "approved" if decision == "approve" else "rejected"
        record = self.repository.decide_approval(
            principal.tenant_id,
            approval_id,
            status,
            principal.email,
            str(body.get("note") or "")[:500],
        )
        if record is None:
            raise PolicyError("This approval was already decided.")
        self.repository.add_audit(
            AuditRecord(principal.tenant_id, principal.email, f"approval_{record.status}", record.id, {"tool": record.tool, "runId": record.run_id})
        )
        run = self.repository.get_agent_run(
            principal.tenant_id,
            record.run_id,
        )
        if run is None:
            raise NotFound("Run not found.")
        run["status"] = "running"
        self.agent_graph.invoke(run)
        self.repository.save_agent_run(run)
        result = run
        parent_id = run.get("parentRunId")
        if parent_id:
            result = self.repository.get_agent_run(
                principal.tenant_id,
                parent_id,
            )
            if result is None:
                raise NotFound("Parent run not found.")
            if run["status"] == "awaiting_approval":
                result["pendingApprovalId"] = run["pendingApprovalId"]
            else:
                result["status"] = "running"
                self.supervisor_graph.invoke(result)
            self.repository.save_agent_run(result)
        return {"approval": record.public(), "run": self._public(result)}

    def _build_agent_graph(self) -> StateGraph:
        graph = StateGraph("agent", max_transitions=self.settings.agents.max_steps * 2 + 4)
        graph.add_node("plan", self._plan)
        graph.add_node("act", self._act)
        graph.add_node("respond", self._respond)
        graph.set_entry(lambda state: "act" if state.get("nextTool") else "plan")
        graph.add_conditional_edges("plan", lambda state: "act" if state.get("nextTool") else "respond")
        graph.add_conditional_edges("act", lambda state: END if state["status"] == "awaiting_approval" else "plan")
        graph.add_edge("respond", END)
        return graph

    def _build_supervisor_graph(self) -> StateGraph:
        graph = StateGraph("supervisor", max_transitions=self.settings.agents.max_delegations * 2 + 4)
        graph.add_node("route", self._route)
        graph.add_node("delegate", self._delegate)
        graph.add_node("respond", self._summarize)
        graph.set_entry(lambda state: "delegate" if state.get("childRunId") else "route")
        graph.add_conditional_edges("route", lambda state: "delegate" if state.get("nextAgent") else "respond")
        graph.add_conditional_edges("delegate", lambda state: END if state["status"] == "awaiting_approval" else "route")
        graph.add_edge("respond", END)
        return graph

    def _plan(self, state: dict) -> dict:
        remaining = [tool for tool in state["tools"] if tool not in state["used"]]
        if not remaining or len(state["steps"]) >= self.settings.agents.max_steps:
            return {"nextTool": None}
        schema = {
            "required": ["tool", "input"],
            "properties": {"tool": {"type": "string", "enum": [*remaining, "finish"]}, "input": {"type": "string"}},
        }
        tools = "\n".join(f"- {tool}: {TOOL_DESCRIPTIONS[tool]}" for tool in remaining)
        prompt = (
            f"You are the {state['agent']} agent. {state['instructions']}\n"
            f"Tools:\n{tools}\n- finish: answer now.\n"
            f"Observations so far:\n{_observations(state)}\n"
            f"Task: {state['message']}\n{schema_instructions(schema)}"
        )
        result, usage = self._complete(state, prompt, schema)
        choice = result.structured or {}
        tool = choice.get("tool")
        if tool not in remaining:
            return {"nextTool": None, "usage": usage}
        return {"nextTool": {"tool": tool, "input": str(choice.get("input") or state["message"])[:2000]}, "usage": usage}

    def _act(self, state: dict) -> dict:
        call = state["nextTool"]
        tool = call["tool"]
        step = {"tool": tool, "input": call["input"]}
        if tool in self.settings.agents.approval_tools:
            approval_id = state.get("pendingApprovalId")
            if not approval_id:
                record = ApprovalRecord(str(uuid.uuid4()), state["tenantId"], state["id"], tool, call["input"], state["requestedBy"])
                self.repository.create_approval(record)
                self.repository.add_audit(
                    AuditRecord(state["tenantId"], state["requestedBy"], "approval_requested", record.id, {"tool": tool, "runId": state["id"]})
                )
                return {"status": "awaiting_approval", "pendingApprovalId": record.id}
            record = self.repository.get_approval(
                state["tenantId"],
                approval_id,
            )
            if record is None:
                raise NotFound("Approval not found.")
            step["approval"] = record.status
            if record.status == "rejected":
                step["observation"] = f"A reviewer rejected this call. {record.note}".strip()
                return self._after_tool(state, step, {})
        step["observation"], extra = self.tools[tool](state, call["input"])
        return self._after_tool(state, step, extra)

    def _after_tool(self, state: dict, step: dict, extra: dict) -> dict:
        return extra | {
            "used": [*state["used"], step["tool"]],
            "steps": [*state["steps"], step],
            "nextTool": None,
            "pendingApprovalId": None,
            "status": "running",
        }

    def _respond(self, state: dict) -> dict:
        prompt = (
            f"Task: {state['message']}\nObservations:\n{_observations(state)}\n"
            "Answer the task using only these observations. Say so when they are not enough."
        )
        result, usage = self._complete(state, prompt)
        return {"answer": result.text, "status": "completed", "usage": usage}

    def _route(self, state: dict) -> dict:
        remaining = [agent for agent in state["agents"] if agent not in state["visited"]]
        if not remaining or len(state["delegations"]) >= self.settings.agents.max_delegations:
            return {"nextAgent": None}
        profiles = self.settings.agents.profiles
        schema = {
            "required": ["agent", "task"],
            "properties": {"agent": {"type": "string", "enum": [*remaining, "finish"]}, "task": {"type": "string"}},
        }
        roster = "\n".join(f"- {agent}: {profiles[agent].description}" for agent in remaining)
        findings = "\n".join(f"{item['agent']}: {item['answer']}" for item in state["delegations"]) or "None yet."
        prompt = (
            "You supervise a team of agents. Pick the next agent, or finish when the findings answer the request.\n"
            f"Agents:\n{roster}\n- finish: stop delegating.\nFindings:\n{findings}\n"
            f"Request: {state['message']}\n{schema_instructions(schema)}"
        )
        result, usage = self._complete(state, prompt, schema)
        choice = result.structured or {}
        agent = choice.get("agent")
        if agent not in remaining:
            return {"nextAgent": None, "usage": usage}
        return {"nextAgent": {"agent": agent, "task": str(choice.get("task") or "")[:1000]}, "usage": usage}

    def _delegate(self, state: dict) -> dict:
        child_id = state.get("childRunId")
        if child_id:
            child = self.repository.get_agent_run(
                state["tenantId"],
                child_id,
            )
            if child is None:
                raise NotFound("Child run not found.")
        else:
            target = state["nextAgent"]
            profile = self.settings.agents.profiles[target["agent"]]
            task = state["message"] if not target["task"] else f"{state['message']}\nFocus: {target['task']}"
            child = self._child_state(state, target["agent"], task, profile.description)
            child["tools"] = list(profile.tools)
            self.agent_graph.invoke(child)
            self.repository.save_agent_run(child)
        if child["status"] == "awaiting_approval":
            return {"status": "awaiting_approval", "childRunId": child["id"], "pendingApprovalId": child["pendingApprovalId"]}
        delegation = {"agent": child["agent"], "runId": child["id"], "answer": child["answer"]}
        return {
            "usage": _add_usage(state["usage"], child["usage"]),
            "visited": [*state["visited"], child["agent"]],
            "delegations": [*state["delegations"], delegation],
            "nextAgent": None,
            "childRunId": None,
            "pendingApprovalId": None,
            "status": "running",
        }

    def _summarize(self, state: dict) -> dict:
        findings = "\n".join(f"{item['agent']}: {item['answer']}" for item in state["delegations"]) or "No agent was needed."
        prompt = f"Request: {state['message']}\nAgent findings:\n{findings}\nWrite the final answer from these findings."
        result, usage = self._complete(state, prompt)
        return {"answer": result.text, "status": "completed", "usage": usage}

    def _retrieve(self, state: dict, query: str) -> tuple[str, dict]:
        vector = self.provider.embed([query])[0]
        matches = [(score, chunk) for score, chunk in self.repository.search(state["tenantId"], vector, self.settings.top_k) if score > 0]
        if not matches:
            return "No matching documents.", {}
        citations = [chunk.citation() | {"score": round(score, 4)} for score, chunk in matches]
        return "\n".join(item["excerpt"] for item in citations), {"citations": [*state["citations"], *citations]}

    def _list_documents(self, state: dict, _input: str) -> tuple[str, dict]:
        names = sorted(
            {
                doc.filename
                for doc in self.repository.list_documents(state["tenantId"])
            }
        )
        return ", ".join(names) or "No documents are uploaded.", {}

    def _notify(self, state: dict, text: str) -> tuple[str, dict]:
        if not self.settings.webhook.url:
            return "No webhook is configured.", {}
        body = json.dumps(
            {"type": "agent.notification", "tenantId": state["tenantId"], "runId": state["id"], "message": text},
            separators=(",", ":"),
        ).encode()
        self.repository.add_webhook(
            {"url": self.settings.webhook.url, "body": body, "signature": sign_webhook(self.settings.webhook.secret, body)}
        )
        return "Notification sent.", {}

    def _complete(self, state: dict, prompt: str, schema: dict | None = None):
        result = self.provider.complete(prompt, schema)
        model = self.settings.chat.model
        cost = token_cost(self.settings, model, result.input_tokens, result.output_tokens)
        self.gate.record_cost(state["tenantId"], cost)
        self.repository.add_usage(UsageRecord(state["tenantId"], model, result.input_tokens, result.output_tokens, cost, state["kind"]))
        spent = {"inputTokens": result.input_tokens, "outputTokens": result.output_tokens, "costUsd": cost}
        return result, _add_usage(state["usage"], spent)

    def _check_tools(self, tools: list[str]) -> None:
        missing = [tool for tool in tools if tool not in self.tools]
        if missing:
            raise PolicyError(f"Tools have no implementation: {', '.join(missing)}.")

    def _new_state(self, principal: Principal, kind: str, agent: str, message: str, instructions: str) -> dict:
        state = {
            "id": str(uuid.uuid4()),
            "kind": kind,
            "tenantId": principal.tenant_id,
            "requestedBy": principal.email,
            "agent": agent,
            "instructions": instructions,
            "message": message,
            "tools": [],
            "used": [],
            "steps": [],
            "citations": [],
            "status": "running",
            "answer": "",
            "nextTool": None,
            "pendingApprovalId": None,
            "parentRunId": None,
            "usage": {"inputTokens": 0, "outputTokens": 0, "costUsd": 0.0},
            "trace": [],
            "createdAt": datetime.now(UTC).isoformat(),
        }
        self.repository.save_agent_run(state)
        return state

    def _child_state(self, parent: dict, agent: str, message: str, instructions: str) -> dict:
        principal = Principal(parent["requestedBy"], parent["tenantId"], [], [])
        child = self._new_state(principal, "agent", agent, message, instructions)
        child["parentRunId"] = parent["id"]
        self.repository.save_agent_run(child)
        return child

    def _owned_run(self, principal: Principal, run_id: str) -> dict:
        run = self.repository.get_agent_run(principal.tenant_id, run_id)
        if run is None:
            raise NotFound("Run not found.")
        return run

    def _public(self, state: dict) -> dict:
        approval = self.repository.get_approval(
            state["tenantId"],
            state.get("pendingApprovalId") or "",
        )
        payload = {
            "runId": state["id"],
            "kind": state["kind"],
            "agent": state["agent"],
            "status": state["status"],
            "answer": state["answer"],
            "steps": state["steps"],
            "citations": state["citations"],
            "pendingApproval": approval.public() if approval else None,
            "parentRunId": state["parentRunId"],
            "usage": state["usage"],
            "trace": state["trace"],
        }
        if state["kind"] == "supervisor":
            payload["delegations"] = state["delegations"]
        return payload

    def _audit(self, principal: Principal, action: str, state: dict) -> None:
        digest = hashlib.sha256(state["message"].encode()).hexdigest()
        self.repository.add_audit(
            AuditRecord(principal.tenant_id, principal.email, action, state["id"], {"promptSha256": digest, "promptChars": len(state["message"])})
        )


def _message(body: dict) -> str:
    message = (body.get("message") or "").strip()
    if not message:
        raise PolicyError("A message is required.")
    return message


def _observations(state: dict) -> str:
    lines = [f"[{step['tool']}] {step['observation']}" for step in state["steps"]]
    return "\n".join(lines) or "None yet."


def _add_usage(total: dict, extra: dict) -> dict:
    return {key: total[key] + extra[key] for key in ("inputTokens", "outputTokens", "costUsd")}
