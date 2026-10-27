from __future__ import annotations

import uuid

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.contracts import DocumentStore, JobQueue, ModelProvider
from forgearc_ai.errors import NotFound, ProviderError
from forgearc_ai.rag import Chunk, chunk_text, load_document
from forgearc_ai.repositories import (
    AuditRecord,
    DocumentRecord,
    JobRecord,
    Repository,
    sign_webhook,
    webhook_body,
)


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        provider: ModelProvider,
        repository: Repository,
        documents: DocumentStore | None = None,
        queue: JobQueue | None = None,
    ):
        self.settings = settings
        self.provider = provider
        self.repository = repository
        self.documents = documents
        self.queue = queue

    def submit(
        self,
        principal: Principal,
        filename: str,
        content: bytes,
        corpus_id: str,
        idempotency_key: str,
    ) -> dict:
        existing = self.repository.find_job(
            principal.tenant_id,
            idempotency_key,
        )
        if existing:
            return {
                "jobId": existing.id,
                "status": existing.status,
                "documentId": existing.document_id,
            }
        document_id = str(uuid.uuid4())
        if self.documents is not None:
            self.documents.put(self.settings.bucket, document_id, content)
        record = DocumentRecord(
            document_id,
            principal.tenant_id,
            corpus_id or document_id,
            filename,
            "",
        )
        setattr(record, "raw", content)
        self.repository.add_document(record)
        job = self.repository.enqueue(
            principal.tenant_id,
            document_id,
            idempotency_key,
        )
        if self.queue is not None:
            self.queue.send(
                job.id,
                {
                    "jobId": job.id,
                    "tenantId": principal.tenant_id,
                    "documentId": document_id,
                    "corpusId": record.corpus_id,
                    "filename": filename,
                    "idempotencyKey": idempotency_key,
                },
            )
        elif self.settings.jobs_provider == "inline":
            self.process(job.id)
        return {
            "jobId": job.id,
            "status": self.repository.get_job(
                job.id,
                principal.tenant_id,
            ).status,
            "documentId": document_id,
        }

    def process_message(self, payload: str | dict) -> JobRecord:
        if isinstance(payload, str):
            return self.process(payload)
        job_id = str(payload["jobId"])
        tenant_id = str(payload["tenantId"])
        if self.repository.get_job(job_id, tenant_id) is None:
            document_id = str(payload["documentId"])
            idempotency_key = str(payload.get("idempotencyKey") or job_id)
            self.repository.add_document(
                DocumentRecord(
                    document_id,
                    tenant_id,
                    str(payload.get("corpusId") or document_id),
                    str(payload["filename"]),
                    "",
                )
            )
            self.repository.enqueue(
                tenant_id,
                document_id,
                idempotency_key,
                job_id=job_id,
            )
        return self.process(job_id)

    def process(self, job_id: str) -> JobRecord:
        job = self.repository.get_job(job_id)
        if job is None:
            raise NotFound("Job not found.")
        if job.status == "completed":
            return job
        job.attempts += 1
        document = self.repository.get_document(
            job.document_id,
            job.tenant_id,
        )
        if document is None:
            raise NotFound("Document not found.")
        try:
            raw = getattr(document, "raw", document.text.encode())
            if self.documents is not None and not raw:
                raw = self.documents.get(self.settings.bucket, document.id)
            text = load_document(document.filename, raw)
            if not text:
                raise ProviderError("The document did not contain readable text.")
            document.text = text
            pieces = chunk_text(text, self.settings.chunk_chars)
            vectors = self.provider.embed(pieces)
            for piece, vector in zip(pieces, vectors):
                self.repository.add_chunk(
                    Chunk(
                        id=str(uuid.uuid4()),
                        tenant_id=document.tenant_id,
                        corpus_id=document.corpus_id,
                        document_id=document.id,
                        text=piece,
                        embedding=vector,
                    )
                )
            job.status = "completed"
            job.error = ""
            self.repository.add_document(document)
            self.repository.save_job(job)
            if self.queue is not None:
                self.queue.record_status(job.id, job.status)
            self._notify(job)
        except Exception as exc:
            job.error = exc.__class__.__name__
            job.status = (
                "dead"
                if job.attempts >= self.settings.limits.job_attempts
                else "retry"
            )
            if self.queue is not None:
                self.queue.record_status(job.id, job.status, job.error)
            self.repository.save_job(job)
            if job.status == "dead":
                self._notify(job)
            raise
        return job

    def retrieve(
        self,
        principal: Principal,
        query: str,
        top_k: int,
    ) -> dict:
        result = self.repository.search(
            principal.tenant_id,
            self.provider.embed([query])[0],
            top_k,
        )
        return {
            "matches": [
                chunk.citation() | {"score": round(score, 4)}
                for score, chunk in result
            ]
        }

    def status(self, principal: Principal, job_id: str) -> dict:
        job = self.repository.get_job(job_id, principal.tenant_id)
        if job is None:
            raise NotFound("Job not found.")
        return {
            "jobId": job.id,
            "status": job.status,
            "attempts": job.attempts,
            "documentId": job.document_id,
            "error": job.error,
        }

    def delete_corpus(self, principal: Principal, corpus_id: str) -> dict:
        removed = self.repository.delete_corpus(principal.tenant_id, corpus_id)
        self.repository.add_audit(
            AuditRecord(
                principal.tenant_id,
                principal.email,
                "delete_corpus",
                corpus_id,
                {"removed": removed},
            )
        )
        return {"corpusId": corpus_id, "removedChunks": removed}

    def _notify(self, job: JobRecord) -> None:
        if not self.settings.webhook.url:
            return
        body = webhook_body(job)
        self.repository.add_webhook(
            {
                "url": self.settings.webhook.url,
                "body": body,
                "signature": sign_webhook(self.settings.webhook.secret, body),
            }
        )
