from __future__ import annotations

from datetime import datetime
from typing import Protocol

from forgearc_ai.rag import Chunk
from forgearc_ai.repositories.records import (
    ApprovalRecord,
    AuditRecord,
    DocumentRecord,
    EvaluationRecord,
    JobRecord,
    UsageRecord,
)


class Repository(Protocol):
    """Durable application state boundary used by every service."""

    def healthcheck(self) -> bool: ...

    def add_document(self, record: DocumentRecord) -> None: ...

    def get_document(
        self,
        document_id: str,
        tenant_id: str | None = None,
    ) -> DocumentRecord | None: ...

    def list_documents(self, tenant_id: str) -> list[DocumentRecord]: ...

    def add_chunk(self, chunk: Chunk) -> None: ...

    def search(
        self,
        tenant_id: str,
        embedding: list[float],
        top_k: int,
    ) -> list[tuple[float, Chunk]]: ...

    def delete_corpus(self, tenant_id: str, corpus_id: str) -> int: ...

    def enqueue(
        self,
        tenant_id: str,
        document_id: str,
        idempotency_key: str,
        *,
        job_id: str | None = None,
    ) -> JobRecord: ...

    def get_job(
        self,
        job_id: str,
        tenant_id: str | None = None,
    ) -> JobRecord | None: ...

    def find_job(
        self,
        tenant_id: str,
        idempotency_key: str,
    ) -> JobRecord | None: ...

    def save_job(self, job: JobRecord) -> None: ...

    def remember(
        self,
        tenant_id: str,
        conversation_id: str,
        role: str,
        text: str,
    ) -> None: ...

    def history(self, tenant_id: str, conversation_id: str) -> list[dict]: ...

    def add_usage(self, record: UsageRecord) -> None: ...

    def list_usage(
        self,
        tenant_id: str,
        *,
        since: datetime | None = None,
    ) -> list[UsageRecord]: ...

    def add_audit(self, record: AuditRecord) -> None: ...

    def add_webhook(self, payload: dict) -> None: ...

    def save_agent_run(self, state: dict) -> None: ...

    def get_agent_run(self, tenant_id: str, run_id: str) -> dict | None: ...

    def list_agent_runs(self, tenant_id: str) -> list[dict]: ...

    def create_approval(self, record: ApprovalRecord) -> None: ...

    def get_approval(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> ApprovalRecord | None: ...

    def list_approvals(
        self,
        tenant_id: str,
        status: str = "pending",
    ) -> list[ApprovalRecord]: ...

    def decide_approval(
        self,
        tenant_id: str,
        approval_id: str,
        decision: str,
        decided_by: str,
        note: str,
    ) -> ApprovalRecord | None: ...

    def add_evaluation(self, record: EvaluationRecord) -> None: ...

    def list_evaluations(self, tenant_id: str) -> list[EvaluationRecord]: ...
