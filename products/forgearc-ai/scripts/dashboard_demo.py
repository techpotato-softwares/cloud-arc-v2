"""Run the real dashboard with deterministic sample data for screenshots.

uv run --package forgearc-ai-api uvicorn dashboard_demo:app \
  --app-dir scripts --port 4021
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from forgearc_ai.config import load_settings
from forgearc_ai.repositories import ApprovalRecord, UsageRecord
from forgearc_ai_api.app import create_app
from forgearc_ai_api.wiring import build_container


def create_demo_app():
    settings = load_settings()
    container = build_container(settings)
    repository = container.get("Repository")
    now = datetime.now(UTC)
    features = ("chat", "agent", "supervisor", "decision", "evaluation")
    models = (
        "gpt-4o-mini",
        "anthropic.claude-3-5-sonnet",
        "gemini-2.0-flash",
    )
    for day in range(30):
        calls = 2 + day % 5
        for index in range(calls):
            feature = features[(day + index) % len(features)]
            model = models[(day + index) % len(models)]
            input_tokens = 420 + day * 17 + index * 83
            output_tokens = 130 + index * 31
            repository.add_usage(
                UsageRecord(
                    "demo",
                    model,
                    input_tokens,
                    output_tokens,
                    round((input_tokens * 0.003 + output_tokens * 0.012) / 1000, 5),
                    feature,
                    now - timedelta(days=29 - day),
                )
            )
    run = {
        "id": "sample-agent-run",
        "kind": "agent",
        "tenantId": "demo",
        "requestedBy": "admin@forgearc.dev",
        "agent": "operator",
        "instructions": "",
        "message": "Notify billing about the approved refund.",
        "tools": ["notify_webhook"],
        "used": [],
        "steps": [],
        "citations": [],
        "status": "awaiting_approval",
        "answer": "",
        "nextTool": {
            "tool": "notify_webhook",
            "input": "Refund request RF-2048 passed policy review.",
        },
        "pendingApprovalId": "sample-approval",
        "parentRunId": None,
        "usage": {
            "inputTokens": 640,
            "outputTokens": 72,
            "costUsd": 0.0041,
        },
        "trace": ["plan", "act"],
        "createdAt": now.isoformat(),
    }
    repository.save_agent_run(run)
    repository.create_approval(
        ApprovalRecord(
            "sample-approval",
            "demo",
            run["id"],
            "notify_webhook",
            "Refund request RF-2048 passed policy review.",
            "admin@forgearc.dev",
            created_at=now - timedelta(minutes=8),
        )
    )
    return create_app(settings, container)


app = create_demo_app()
