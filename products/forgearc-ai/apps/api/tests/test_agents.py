from __future__ import annotations

import json

import pytest
from forgearc_ai.auth import Principal, issue_token
from forgearc_ai.errors import ConfigError, ProviderError
from forgearc_ai.graph import END, StateGraph
from forgearc_ai.repositories import sign_webhook
from forgearc_ai.structured import parse_structured

from test_ai import api, login, settings

DOCUMENT = b"ForgeArc ships source code to the buyer.\n\nRefunds are processed within five business days."


def upload(client, headers):
    response = client.post(
        "/api/documents",
        headers=headers,
        files={"file": ("policy.md", DOCUMENT, "text/markdown")},
        data={"corpusId": "policies", "idempotencyKey": "policy-1"},
    )
    assert response.json()["status"] == "completed"


def agent_webhooks(container):
    return [hook for hook in container.get("Store").webhooks if json.loads(hook["body"]).get("type") == "agent.notification"]


def test_agent_uses_tools_and_waits_for_a_second_person_to_approve():
    client, container = api()
    ada = login(client)
    rita = login(client, "rita@example.com", "review")
    upload(client, ada)

    started = client.post(
        "/api/agents/run",
        headers=ada,
        json={"message": "How long do refunds take? Tell the billing team.", "tools": ["retrieve_documents", "notify_webhook"]},
    )
    assert started.status_code == 200
    run = started.json()
    assert run["status"] == "awaiting_approval"
    assert run["steps"][0]["tool"] == "retrieve_documents"
    assert run["citations"]
    approval = run["pendingApproval"]
    assert approval["tool"] == "notify_webhook"
    assert agent_webhooks(container) == []

    pending = client.get("/api/approvals", headers=rita).json()["approvals"]
    assert [item["approvalId"] for item in pending] == [approval["approvalId"]]
    assert client.post(f"/api/approvals/{approval['approvalId']}", headers=ada, json={"decision": "approve"}).status_code == 403

    decided = client.post(f"/api/approvals/{approval['approvalId']}", headers=rita, json={"decision": "approve", "note": "ok"})
    assert decided.status_code == 200
    body = decided.json()
    assert body["approval"]["status"] == "approved"
    assert body["approval"]["decidedBy"] == "rita@example.com"
    assert body["run"]["status"] == "completed"
    assert [step["tool"] for step in body["run"]["steps"]] == ["retrieve_documents", "notify_webhook"]
    assert body["run"]["steps"][1]["observation"] == "Notification sent."
    hooks = agent_webhooks(container)
    assert len(hooks) == 1
    assert hooks[0]["signature"] == sign_webhook("hook-secret", hooks[0]["body"])

    again = client.post(f"/api/approvals/{approval['approvalId']}", headers=rita, json={"decision": "approve"})
    assert again.status_code == 422
    assert client.get(f"/api/agents/runs/{run['runId']}", headers=ada).json()["status"] == "completed"
    outsider = issue_token(settings(), Principal("bea@example.com", "tenant-b", ["ai:read"], ["ai"]))
    assert client.get(f"/api/agents/runs/{run['runId']}", headers={"Authorization": f"Bearer {outsider}"}).status_code == 404

    audit = [row.action for row in container.get("Store").audit]
    assert {"agent_run", "approval_requested", "approval_approved"} <= set(audit)
    assert "Tell the billing team" not in json.dumps([row.metadata for row in container.get("Store").audit])


def test_rejected_tool_call_never_runs():
    client, container = api()
    ada = login(client)
    rita = login(client, "rita@example.com", "review")
    run = client.post("/api/agents/run", headers=ada, json={"message": "Notify the team.", "tools": ["notify_webhook"]}).json()
    decided = client.post(
        f"/api/approvals/{run['pendingApproval']['approvalId']}",
        headers=rita,
        json={"decision": "reject", "note": "Wrong channel"},
    ).json()
    assert decided["run"]["status"] == "completed"
    assert decided["run"]["steps"][0]["approval"] == "rejected"
    assert "Wrong channel" in decided["run"]["steps"][0]["observation"]
    assert agent_webhooks(container) == []


def test_supervisor_delegates_pauses_for_approval_and_resumes():
    client, container = api()
    ada = login(client)
    rita = login(client, "rita@example.com", "review")
    upload(client, ada)

    started = client.post("/api/agents/supervise", headers=ada, json={"message": "Summarize the refund policy and notify billing."})
    assert started.status_code == 200
    parent = started.json()
    assert parent["kind"] == "supervisor"
    assert parent["status"] == "awaiting_approval"
    assert [item["agent"] for item in parent["delegations"]] == ["researcher"]
    approval_id = parent["pendingApproval"]["approvalId"]

    resumed = client.post(f"/api/approvals/{approval_id}", headers=rita, json={"decision": "approve"}).json()["run"]
    assert resumed["runId"] == parent["runId"]
    assert resumed["status"] == "completed"
    assert [item["agent"] for item in resumed["delegations"]] == ["researcher", "operator"]
    assert resumed["answer"]
    children = [container.get("Store").agent_runs[item["runId"]] for item in resumed["delegations"]]
    assert all(child["parentRunId"] == parent["runId"] for child in children)
    assert resumed["usage"]["costUsd"] > sum(child["usage"]["costUsd"] for child in children)
    assert len(agent_webhooks(container)) == 1


def test_agent_policy_is_enforced():
    client, _container = api()
    ada = login(client)
    rita = login(client, "rita@example.com", "review")
    assert client.post("/api/agents/run", headers=ada, json={"message": "hi", "agent": "researcher", "tools": ["notify_webhook"]}).status_code == 422
    assert client.post("/api/agents/run", headers=ada, json={"message": "hi", "agent": "ghost"}).status_code == 404
    assert client.post("/api/agents/run", headers=ada, json={"message": "hi", "tools": ["shell"]}).status_code == 422
    assert client.post("/api/agents/run", headers=ada, json={"message": "blocked-phrase"}).status_code == 422
    assert client.post("/api/agents/run", headers=rita, json={"message": "hi"}).status_code == 403
    with pytest.raises(ConfigError, match="outside tool_allowlist"):
        settings(tool_allowlist=["retrieve_documents"])


def test_evaluation_scores_grounding_and_applies_thresholds():
    client, container = api()
    ada = login(client)
    upload(client, ada)
    context = "Refunds are processed within five business days."
    response = client.post(
        "/api/evaluations",
        headers=ada,
        json={
            "samples": [
                {"question": "How long do refunds take?", "answer": "Refunds are processed within five business days.", "contexts": [context], "reference": context},
                {"question": "How long do refunds take?", "answer": "Refunds arrive instantly by courier pigeon.", "contexts": [context], "reference": context},
                {"question": "What does ForgeArc ship?"},
            ],
            "thresholds": {"faithfulness": 0.9},
        },
    )
    assert response.status_code == 200
    body = response.json()
    grounded, invented, generated = body["results"]
    assert grounded["faithfulness"] == 1.0
    assert grounded["contextRecall"] == 1.0
    assert invented["faithfulness"] < grounded["faithfulness"]
    assert generated["contextRecall"] is None
    assert body["passed"] is False
    assert "faithfulness" in body["failed"]
    assert set(body["ragasDataset"][0]) == {"user_input", "response", "retrieved_contexts", "reference"}
    assert "reference" not in body["ragasDataset"][2]
    features = {row.feature for row in container.get("Store").usage}
    assert "evaluation" in features
    history = client.get("/api/evaluations", headers=ada).json()["evaluations"]
    assert history[0]["evaluationId"] == body["evaluationId"]

    missing = client.post("/api/evaluations", headers=ada, json={"engine": "ragas", "samples": [{"question": "q", "answer": "a", "contexts": ["c"]}]})
    try:
        import ragas  # noqa: F401
    except ImportError:
        assert missing.status_code == 500
        assert "ragas extra" in missing.json()["message"]
    assert client.post("/api/evaluations", headers=ada, json={"samples": []}).status_code == 422


def test_cost_dashboard_breaks_down_spend():
    client, _container = api()
    ada = login(client)
    rita = login(client, "rita@example.com", "review")
    client.post("/api/ai/chat", headers=ada, json={"message": "hello"})
    client.post("/api/agents/run", headers=ada, json={"message": "Notify the team.", "tools": ["notify_webhook"]})
    dashboard = client.get("/api/usage/dashboard?days=7", headers=rita)
    assert dashboard.status_code == 200
    data = dashboard.json()
    assert data["days"] == 7
    assert len(data["byDay"]) == 7
    assert data["byDay"][-1]["calls"] == data["totals"]["calls"]
    assert {row["feature"] for row in data["byFeature"]} == {"chat", "agent"}
    assert data["byModel"][0]["model"] == "fake-chat"
    assert data["budget"]["monthlyUsd"] == 25
    assert data["budget"]["spentUsd"] == pytest.approx(data["totals"]["costUsd"])
    assert data["budget"]["projectedUsd"] >= data["budget"]["spentUsd"]
    assert data["agents"] == {"runs": 1, "awaitingApproval": 1}
    page = client.get("/dashboard")
    assert page.status_code == 200
    assert "Cost and approvals" in page.text


def test_state_graph_runs_and_stops_runaway_loops():
    graph = StateGraph("count", max_transitions=5)
    graph.add_node("step", lambda state: {"count": state.get("count", 0) + 1})
    graph.set_entry(lambda _state: "step")
    graph.add_conditional_edges("step", lambda state: END if state["count"] >= 3 else "step")
    assert graph.invoke({})["count"] == 3
    runaway = StateGraph("loop", max_transitions=3)
    runaway.add_node("step", lambda _state: {})
    runaway.set_entry(lambda _state: "step")
    runaway.add_edge("step", "step")
    with pytest.raises(Exception, match="exceeded"):
        runaway.invoke({})


def test_state_graph_compiles_on_langgraph():
    pytest.importorskip("langgraph")
    graph = StateGraph("count")
    graph.add_node("step", lambda state: {"count": state.get("count", 0) + 1})
    graph.set_entry(lambda _state: "step")
    graph.add_conditional_edges("step", lambda state: END if state["count"] >= 3 else "step")
    assert graph.compile_langgraph().invoke({"count": 0, "keep": True}) == {"count": 3, "keep": True}

    client, container = api()
    upload(client, login(client))
    agents = container.get("AgentService")
    state = agents._new_state(Principal("ada@example.com", "tenant-a", [], []), "agent", "researcher", "How long do refunds take?", "")
    state["tools"] = ["retrieve_documents", "list_documents"]
    result = agents.agent_graph.compile_langgraph().invoke(dict(state))
    assert result["status"] == "completed"
    assert [step["tool"] for step in result["steps"]] == ["retrieve_documents", "list_documents"]
    assert result["citations"]
    assert result["usage"]["costUsd"] > 0


def test_structured_replies_tolerate_fences():
    assert parse_structured('```json\n{"tool": "finish"}\n```') == {"tool": "finish"}
    assert parse_structured('Sure: {"tool": "retrieve_documents", "input": "refunds"} done') == {"tool": "retrieve_documents", "input": "refunds"}
    with pytest.raises(ProviderError):
        parse_structured("no json here")
