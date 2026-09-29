from __future__ import annotations

import hashlib
import json
import uuid
from collections.abc import Iterator

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.contracts import DocumentStore, JobQueue, ModelProvider
from forgearc_ai.errors import NotFound, ProviderError
from forgearc_ai.policy import PolicyGate
from forgearc_ai.providers.jev import DecisionAnswer, JevProvider
from forgearc_ai.rag import Chunk, chunk_text, load_document
from forgearc_ai.stores import AuditRecord, DocumentRecord, JobRecord, MemoryGraph, UsageRecord, sign_webhook, webhook_body


class ChatService:
    def __init__(
        self,
        settings: Settings,
        provider: ModelProvider,
        gate: PolicyGate,
        store: MemoryGraph,
    ):
        self.settings = settings
        self.provider = provider
        self.gate = gate
        self.store = store

    def complete(self, principal: Principal, body: dict) -> dict:
        prompt, citations = self._prepare(principal, body)
        result = self.provider.complete(prompt, body.get("responseSchema"))
        self._account(principal, body, result.input_tokens, result.output_tokens, result.text)
        return {
            "reply": result.text,
            "structured": result.structured,
            "citations": citations,
            "usage": self._usage(result.input_tokens, result.output_tokens),
        }

    def stream(self, principal: Principal, body: dict) -> Iterator[str]:
        prompt, citations = self._prepare(principal, body)
        input_tokens = 0
        output_tokens = 0
        text = ""
        for delta, result in self.provider.stream(prompt):
            if delta:
                text += delta
                yield _sse({"delta": delta})
            if result.text or result.input_tokens:
                text = result.text or text
                input_tokens = result.input_tokens
                output_tokens = result.output_tokens
        self._account(principal, body, input_tokens, output_tokens, text)
        yield _sse({"citations": citations, "usage": self._usage(input_tokens, output_tokens), "done": True})

    def _prepare(self, principal: Principal, body: dict) -> tuple[str, list[dict]]:
        message = (body.get("message") or "").strip()
        tools = list(body.get("tools") or [])
        self.gate.check_prompt(principal, message, tools)
        conversation = body.get("conversationId") or "default"
        history = self.store.history(principal.tenant_id, conversation)
        embedding = self.provider.embed([message])[0]
        matches = self.store.search(principal.tenant_id, embedding, self.settings.top_k)
        citations = [chunk.citation() | {"score": round(score, 4)} for score, chunk in matches if score > 0]
        context = "\n".join(item["excerpt"] for item in citations)
        prompt = f"History: {history}\nSources:\n{context}\nQuestion: {message}"
        return prompt, citations

    def _account(self, principal: Principal, body: dict, input_tokens: int, output_tokens: int, text: str) -> None:
        usage = self._usage(input_tokens, output_tokens)
        self.gate.record_cost(principal.tenant_id, usage["costUsd"])
        self.store.usage.append(
            UsageRecord(principal.tenant_id, self.settings.chat.model, input_tokens, output_tokens, usage["costUsd"])
        )
        conversation = body.get("conversationId") or "default"
        self.store.remember(principal.tenant_id, conversation, "user", body.get("message") or "")
        self.store.remember(principal.tenant_id, conversation, "assistant", text)
        self.store.audit.append(
            AuditRecord(
                principal.tenant_id,
                principal.email,
                "chat",
                conversation,
                {"promptSha256": hashlib.sha256((body.get("message") or "").encode()).hexdigest(), "promptChars": len(body.get("message") or "")},
            )
        )

    def _usage(self, input_tokens: int, output_tokens: int) -> dict:
        pricing = self.settings.pricing.get(self.settings.chat.model)
        cost = 0.0
        if pricing:
            cost = (input_tokens * pricing.input_per_million + output_tokens * pricing.output_per_million) / 1_000_000
        return {"model": self.settings.chat.model, "inputTokens": input_tokens, "outputTokens": output_tokens, "costUsd": cost}


class IngestionService:
    def __init__(
        self,
        settings: Settings,
        provider: ModelProvider,
        store: MemoryGraph,
        documents: DocumentStore | None = None,
        queue: JobQueue | None = None,
    ):
        self.settings = settings
        self.provider = provider
        self.store = store
        self.documents = documents
        self.queue = queue

    def submit(self, principal: Principal, filename: str, content: bytes, corpus_id: str, idempotency_key: str) -> dict:
        existing = self.store.jobs_by_key.get((principal.tenant_id, idempotency_key))
        if existing:
            job = self.store.jobs[existing]
            return {"jobId": job.id, "status": job.status, "documentId": job.document_id}
        document_id = str(uuid.uuid4())
        if self.documents is not None:
            self.documents.put(self.settings.bucket, document_id, content)
        record = DocumentRecord(document_id, principal.tenant_id, corpus_id or document_id, filename, "")
        setattr(record, "raw", content)
        self.store.add_document(record)
        job = self.store.enqueue(principal.tenant_id, document_id, idempotency_key)
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
        return {"jobId": job.id, "status": self.store.jobs[job.id].status, "documentId": document_id}

    def process_message(self, payload: str | dict) -> JobRecord:
        if isinstance(payload, str):
            return self.process(payload)
        job_id = str(payload["jobId"])
        if job_id not in self.store.jobs:
            document_id = str(payload["documentId"])
            tenant_id = str(payload["tenantId"])
            idempotency_key = str(payload.get("idempotencyKey") or job_id)
            self.store.add_document(
                DocumentRecord(
                    document_id,
                    tenant_id,
                    str(payload.get("corpusId") or document_id),
                    str(payload["filename"]),
                    "",
                )
            )
            job = JobRecord(
                id=job_id,
                tenant_id=tenant_id,
                document_id=document_id,
                idempotency_key=idempotency_key,
            )
            self.store.jobs[job_id] = job
            self.store.jobs_by_key[(tenant_id, idempotency_key)] = job_id
        return self.process(job_id)

    def process(self, job_id: str) -> JobRecord:
        job = self.store.jobs.get(job_id)
        if job is None:
            raise NotFound("Job not found.")
        if job.status == "completed":
            return job
        job.attempts += 1
        document = self.store.documents[job.document_id]
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
                self.store.add_chunk(
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
            if self.queue is not None:
                self.queue.record_status(job.id, job.status)
            self._notify(job)
        except Exception as exc:
            job.error = exc.__class__.__name__
            job.status = "dead" if job.attempts >= self.settings.limits.job_attempts else "retry"
            if self.queue is not None:
                self.queue.record_status(job.id, job.status, job.error)
            if job.status == "dead":
                self._notify(job)
            raise
        return job

    def status(self, principal: Principal, job_id: str) -> dict:
        job = self.store.jobs.get(job_id)
        if job is None or job.tenant_id != principal.tenant_id:
            raise NotFound("Job not found.")
        return {"jobId": job.id, "status": job.status, "attempts": job.attempts, "documentId": job.document_id, "error": job.error}

    def delete_corpus(self, principal: Principal, corpus_id: str) -> dict:
        removed = self.store.delete_corpus(principal.tenant_id, corpus_id)
        self.store.audit.append(AuditRecord(principal.tenant_id, principal.email, "delete_corpus", corpus_id, {"removed": removed}))
        return {"corpusId": corpus_id, "removedChunks": removed}

    def _notify(self, job: JobRecord) -> None:
        if not self.settings.webhook.url:
            return
        body = webhook_body(job)
        self.store.webhooks.append(
            {"url": self.settings.webhook.url, "body": body, "signature": sign_webhook(self.settings.webhook.secret, body)}
        )


class DecisionService:
    def __init__(self, settings: Settings, provider: JevProvider, gate: PolicyGate, store: MemoryGraph):
        self.settings = settings
        self.provider = provider
        self.gate = gate
        self.store = store

    def evaluate(self, principal: Principal, body: dict) -> dict:
        state = body.get("state") or ""
        self.gate.check_prompt(principal, state, [])
        answers, tokens = self.provider.evaluate(state, list(body.get("questions") or []))
        pricing = self.settings.pricing.get(self.settings.jev.model)
        cost = (tokens * pricing.input_per_million / 1_000_000) if pricing else 0.0
        self.gate.record_cost(principal.tenant_id, cost)
        self.store.usage.append(UsageRecord(principal.tenant_id, self.settings.jev.model, tokens, 0, cost))
        review = any(answer.review_required for answer in answers)
        self.store.audit.append(AuditRecord(principal.tenant_id, principal.email, "decision", self.settings.jev.model, {"review": review}))
        return {
            "model": self.settings.jev.model,
            "reviewRequired": review,
            "usage": {"model": self.settings.jev.model, "inputTokens": tokens, "outputTokens": 0, "costUsd": cost},
            "answers": [_answer(item) for item in answers],
        }


class UsageService:
    def __init__(self, store: MemoryGraph):
        self.store = store

    def summary(self, principal: Principal) -> dict:
        rows = [row for row in self.store.usage if row.tenant_id == principal.tenant_id]
        return {
            "calls": len(rows),
            "inputTokens": sum(row.input_tokens for row in rows),
            "outputTokens": sum(row.output_tokens for row in rows),
            "costUsd": sum(row.cost_usd for row in rows),
            "models": sorted({row.model for row in rows}),
        }


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"


def _answer(item: DecisionAnswer) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "value": item.value,
        "probability": item.probability,
        "confidence": item.confidence,
        "reviewRequired": item.review_required,
    }
