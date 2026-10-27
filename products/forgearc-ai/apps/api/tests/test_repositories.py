from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient
from forgearc_ai.models import Base
from forgearc_ai.repositories import (
    ApprovalRecord,
    AuditRecord,
    DocumentRecord,
    MemoryRepository,
    PostgresRepository,
    UsageRecord,
)
from forgearc_ai_api.app import create_app
from forgearc_ai_api.wiring import build_container
from sqlalchemy import create_engine

from test_ai import jev_transport, login, settings


def repositories(tmp_path):
    yield MemoryRepository()
    url = f"sqlite:///{tmp_path / 'repository.sqlite'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    yield PostgresRepository(url, engine=engine)


def test_repository_contract_is_tenant_scoped_and_idempotent(tmp_path):
    for repository in repositories(tmp_path):
        document = DocumentRecord("doc-1", "tenant-a", "corpus", "one.md", "hello")
        repository.add_document(document)
        assert repository.get_document("doc-1") == document
        assert repository.get_document("doc-1", "tenant-b") is None
        assert repository.list_documents("tenant-b") == []

        first = repository.enqueue("tenant-a", "doc-1", "same-key")
        second = repository.enqueue("tenant-a", "doc-1", "same-key")
        assert first.id == second.id
        first.status = "completed"
        repository.save_job(first)
        assert repository.get_job(first.id).status == "completed"
        assert repository.get_job(first.id, "tenant-b") is None

        repository.remember("tenant-a", "conversation", "user", "hello")
        assert repository.history("tenant-a", "conversation") == [
            {"role": "user", "text": "hello"}
        ]
        assert repository.history("tenant-b", "conversation") == []

        repository.add_usage(UsageRecord("tenant-a", "model", 2, 1, 0.1))
        repository.add_audit(
            AuditRecord("tenant-a", "ada@example.com", "test", "one", {})
        )
        assert len(repository.list_usage("tenant-a")) == 1
        assert repository.list_usage("tenant-b") == []


def test_approval_decision_is_atomic(tmp_path):
    url = f"sqlite:///{tmp_path / 'approval.sqlite'}"
    engine = create_engine(url, connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    repository = PostgresRepository(url, engine=engine)
    repository.create_approval(
        ApprovalRecord(
            "approval-1",
            "tenant-a",
            "run-1",
            "notify_webhook",
            "hello",
            "requester@example.com",
        )
    )

    def decide(reviewer):
        return repository.decide_approval(
            "tenant-a",
            "approval-1",
            "approved",
            reviewer,
            "",
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(
            pool.map(
                decide,
                ["one@example.com", "two@example.com"],
            )
        )
    assert sum(outcome is not None for outcome in outcomes) == 1
    assert repository.get_approval(
        "tenant-a",
        "approval-1",
    ).status == "approved"


def test_agent_approval_resumes_after_process_restart(tmp_path):
    url = f"sqlite:///{tmp_path / 'restart.sqlite'}"
    engine = create_engine(url)
    Base.metadata.create_all(engine)
    config = settings(database_url=url)

    first_container = build_container(config, jev_transport=jev_transport)
    first = TestClient(create_app(config, first_container))
    requester = login(first)
    started = first.post(
        "/api/agents/run",
        headers=requester,
        json={
            "message": "Notify the billing team.",
            "tools": ["notify_webhook"],
        },
    ).json()
    assert started["status"] == "awaiting_approval"

    # A fresh container has a new repository object, like a new Lambda process
    # or a replacement ECS/Cloud Run task.
    second_container = build_container(config, jev_transport=jev_transport)
    second = TestClient(create_app(config, second_container))
    reviewer = login(second, "rita@example.com", "review")
    resumed = second.post(
        f"/api/approvals/{started['pendingApproval']['approvalId']}",
        headers=reviewer,
        json={"decision": "approve"},
    )
    assert resumed.status_code == 200
    assert resumed.json()["run"]["status"] == "completed"
