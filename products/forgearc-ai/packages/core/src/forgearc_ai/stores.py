from __future__ import annotations

import hashlib
import hmac
import json
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from forgearc_ai.rag import Chunk, cosine


@dataclass
class DocumentRecord:
    id: str
    tenant_id: str
    corpus_id: str
    filename: str
    text: str


@dataclass
class JobRecord:
    id: str
    tenant_id: str
    document_id: str
    idempotency_key: str
    status: str = "queued"
    attempts: int = 0
    error: str = ""


@dataclass
class UsageRecord:
    tenant_id: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class AuditRecord:
    tenant_id: str
    actor: str
    action: str
    resource: str
    metadata: dict


class MemoryGraph:
    """In-process documents, vectors, jobs, usage, and audit. Tests and local mode use this."""

    def __init__(self) -> None:
        self.documents: dict[str, DocumentRecord] = {}
        self.chunks: list[Chunk] = []
        self.jobs: dict[str, JobRecord] = {}
        self.jobs_by_key: dict[tuple[str, str], str] = {}
        self.usage: list[UsageRecord] = []
        self.audit: list[AuditRecord] = []
        self.memory: dict[tuple[str, str], list[dict]] = {}
        self.webhooks: list[dict] = []

    def add_document(self, record: DocumentRecord) -> None:
        self.documents[record.id] = record

    def add_chunk(self, chunk: Chunk) -> None:
        self.chunks.append(chunk)

    def search(self, tenant_id: str, embedding: list[float], top_k: int) -> list[tuple[float, Chunk]]:
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
            if not (chunk.tenant_id == tenant_id and chunk.corpus_id == corpus_id)
        ]
        self.documents = {
            key: value
            for key, value in self.documents.items()
            if not (value.tenant_id == tenant_id and value.corpus_id == corpus_id)
        }
        return before - len(self.chunks)

    def enqueue(self, tenant_id: str, document_id: str, idempotency_key: str) -> JobRecord:
        existing = self.jobs_by_key.get((tenant_id, idempotency_key))
        if existing:
            return self.jobs[existing]
        job = JobRecord(id=str(uuid.uuid4()), tenant_id=tenant_id, document_id=document_id, idempotency_key=idempotency_key)
        self.jobs[job.id] = job
        self.jobs_by_key[(tenant_id, idempotency_key)] = job.id
        return job

    def remember(self, tenant_id: str, conversation_id: str, role: str, text: str) -> None:
        self.memory.setdefault((tenant_id, conversation_id), []).append({"role": role, "text": text})

    def history(self, tenant_id: str, conversation_id: str) -> list[dict]:
        return list(self.memory.get((tenant_id, conversation_id), []))


def sign_webhook(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def webhook_body(job: JobRecord) -> bytes:
    return json.dumps(
        {"jobId": job.id, "tenantId": job.tenant_id, "status": job.status, "documentId": job.document_id},
        separators=(",", ":"),
    ).encode()
