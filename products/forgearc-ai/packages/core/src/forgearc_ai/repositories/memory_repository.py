from __future__ import annotations

import uuid
from datetime import UTC, datetime
from threading import RLock

from forgearc_ai.rag import Chunk, cosine
from forgearc_ai.repositories.records import (
    ApprovalRecord,
    AuditRecord,
    DocumentRecord,
    EvaluationRecord,
    JobRecord,
    UsageRecord,
)


class MemoryRepository:
    """In-process repository used by tests and local mode."""

    def __init__(self) -> None:
        self.documents: dict[str, DocumentRecord] = {}
        self.chunks: list[Chunk] = []
        self.jobs: dict[str, JobRecord] = {}
        self.jobs_by_key: dict[tuple[str, str], str] = {}
        self.usage: list[UsageRecord] = []
        self.audit: list[AuditRecord] = []
        self.memory: dict[tuple[str, str], list[dict]] = {}
        self.webhooks: list[dict] = []
        self.agent_runs: dict[str, dict] = {}
        self.approvals: dict[str, ApprovalRecord] = {}
        self.evaluations: list[EvaluationRecord] = []
        self._lock = RLock()

    def healthcheck(self) -> bool:
        return True

    def add_document(self, record: DocumentRecord) -> None:
        self.documents[record.id] = record

    def get_document(
        self,
        document_id: str,
        tenant_id: str | None = None,
    ) -> DocumentRecord | None:
        document = self.documents.get(document_id)
        if document is not None and tenant_id is not None and document.tenant_id != tenant_id:
            return None
        return document

    def list_documents(self, tenant_id: str) -> list[DocumentRecord]:
        return [
            record
            for record in self.documents.values()
            if record.tenant_id == tenant_id
        ]

    def add_chunk(self, chunk: Chunk) -> None:
        self.chunks.append(chunk)

    def search(
        self,
        tenant_id: str,
        embedding: list[float],
        top_k: int,
    ) -> list[tuple[float, Chunk]]:
        ranked = [
            (cosine(embedding, chunk.embedding), chunk)
            for chunk in self.chunks
            if chunk.tenant_id == tenant_id
        ]
        ranked.sort(key=lambda item: item[0], reverse=True)
        return ranked[:top_k]

    def delete_corpus(self, tenant_id: str, corpus_id: str) -> int:
        before = len(self.chunks)
        self.chunks = [
            chunk
            for chunk in self.chunks
            if not (
                chunk.tenant_id == tenant_id
                and chunk.corpus_id == corpus_id
            )
        ]
        self.documents = {
            key: value
            for key, value in self.documents.items()
            if not (
                value.tenant_id == tenant_id
                and value.corpus_id == corpus_id
            )
        }
        return before - len(self.chunks)

    def enqueue(
        self,
        tenant_id: str,
        document_id: str,
        idempotency_key: str,
        *,
        job_id: str | None = None,
    ) -> JobRecord:
        existing = self.jobs_by_key.get((tenant_id, idempotency_key))
        if existing:
            return self.jobs[existing]
        job = JobRecord(
            id=job_id or str(uuid.uuid4()),
            tenant_id=tenant_id,
            document_id=document_id,
            idempotency_key=idempotency_key,
        )
        self.jobs[job.id] = job
        self.jobs_by_key[(tenant_id, idempotency_key)] = job.id
        return job

    def get_job(
        self,
        job_id: str,
        tenant_id: str | None = None,
    ) -> JobRecord | None:
        job = self.jobs.get(job_id)
        if job is not None and tenant_id is not None and job.tenant_id != tenant_id:
            return None
        return job

    def find_job(
        self,
        tenant_id: str,
        idempotency_key: str,
    ) -> JobRecord | None:
        job_id = self.jobs_by_key.get((tenant_id, idempotency_key))
        return self.jobs.get(job_id) if job_id else None

    def save_job(self, job: JobRecord) -> None:
        self.jobs[job.id] = job
        self.jobs_by_key[(job.tenant_id, job.idempotency_key)] = job.id

    def remember(
        self,
        tenant_id: str,
        conversation_id: str,
        role: str,
        text: str,
    ) -> None:
        self.memory.setdefault((tenant_id, conversation_id), []).append(
            {"role": role, "text": text}
        )

    def history(self, tenant_id: str, conversation_id: str) -> list[dict]:
        return list(self.memory.get((tenant_id, conversation_id), []))

    def add_usage(self, record: UsageRecord) -> None:
        self.usage.append(record)

    def list_usage(
        self,
        tenant_id: str,
        *,
        since: datetime | None = None,
    ) -> list[UsageRecord]:
        return [
            record
            for record in self.usage
            if record.tenant_id == tenant_id
            and (since is None or record.created_at >= since)
        ]

    def add_audit(self, record: AuditRecord) -> None:
        self.audit.append(record)

    def add_webhook(self, payload: dict) -> None:
        self.webhooks.append(payload)

    def save_agent_run(self, state: dict) -> None:
        self.agent_runs[state["id"]] = state

    def get_agent_run(self, tenant_id: str, run_id: str) -> dict | None:
        state = self.agent_runs.get(run_id)
        if state is None or state["tenantId"] != tenant_id:
            return None
        return state

    def list_agent_runs(self, tenant_id: str) -> list[dict]:
        return [
            state
            for state in self.agent_runs.values()
            if state["tenantId"] == tenant_id
        ]

    def create_approval(self, record: ApprovalRecord) -> None:
        with self._lock:
            self.approvals[record.id] = record

    def get_approval(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> ApprovalRecord | None:
        record = self.approvals.get(approval_id)
        if record is None or record.tenant_id != tenant_id:
            return None
        return record

    def list_approvals(
        self,
        tenant_id: str,
        status: str = "pending",
    ) -> list[ApprovalRecord]:
        return sorted(
            (
                record
                for record in self.approvals.values()
                if record.tenant_id == tenant_id
                and (status == "all" or record.status == status)
            ),
            key=lambda record: record.created_at,
        )

    def decide_approval(
        self,
        tenant_id: str,
        approval_id: str,
        decision: str,
        decided_by: str,
        note: str,
    ) -> ApprovalRecord | None:
        with self._lock:
            record = self.get_approval(tenant_id, approval_id)
            if record is None or record.status != "pending":
                return None
            record.status = decision
            record.decided_by = decided_by
            record.note = note
            record.decided_at = datetime.now(UTC)
            return record

    def add_evaluation(self, record: EvaluationRecord) -> None:
        self.evaluations.append(record)

    def list_evaluations(self, tenant_id: str) -> list[EvaluationRecord]:
        return [
            record
            for record in self.evaluations
            if record.tenant_id == tenant_id
        ]


# Temporary compatibility name for buyers upgrading from 1.0.
MemoryGraph = MemoryRepository
