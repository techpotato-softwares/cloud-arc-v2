from __future__ import annotations

import base64
import json
import uuid
from datetime import UTC, datetime

from sqlalchemy import Engine, create_engine, delete, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, sessionmaker

from forgearc_ai.errors import PolicyError
from forgearc_ai.models import (
    AgentRunRow,
    ApprovalRow,
    AuditRow,
    ChunkRow,
    ConversationMessageRow,
    DocumentRow,
    EvaluationRow,
    JobRow,
    UsageRow,
    WebhookEventRow,
)
from forgearc_ai.rag import Chunk, cosine
from forgearc_ai.repositories.records import (
    ApprovalRecord,
    AuditRecord,
    DocumentRecord,
    EvaluationRecord,
    JobRecord,
    UsageRecord,
)

_SENSITIVE_STATE_KEYS = {
    "api_key",
    "apikey",
    "authorization",
    "password",
    "secret",
    "token",
}


class PostgresRepository:
    """SQLAlchemy repository for PostgreSQL/pgvector and SQLite tests."""

    def __init__(
        self,
        database_url: str,
        *,
        engine: Engine | None = None,
    ):
        self.engine = engine or create_engine(
            database_url,
            pool_pre_ping=True,
        )
        self.sessions = sessionmaker(
            self.engine,
            expire_on_commit=False,
        )
        self.is_postgres = self.engine.dialect.name == "postgresql"

    def healthcheck(self) -> bool:
        with self.engine.connect() as connection:
            return connection.scalar(text("SELECT 1")) == 1

    def add_document(self, record: DocumentRecord) -> None:
        with self._session() as session:
            existing = session.get(DocumentRow, record.id)
            if existing:
                existing.text = record.text
                existing.filename = record.filename
                existing.corpus_id = record.corpus_id
                return
            session.add(
                DocumentRow(
                    id=record.id,
                    tenant_id=record.tenant_id,
                    corpus_id=record.corpus_id,
                    filename=record.filename,
                    text=record.text,
                    created_at=datetime.now(UTC),
                )
            )

    def get_document(
        self,
        document_id: str,
        tenant_id: str | None = None,
    ) -> DocumentRecord | None:
        with self.sessions() as session:
            query = select(DocumentRow).where(DocumentRow.id == document_id)
            if tenant_id is not None:
                query = query.where(DocumentRow.tenant_id == tenant_id)
            row = session.scalar(query)
            return _document(row) if row else None

    def list_documents(self, tenant_id: str) -> list[DocumentRecord]:
        with self.sessions() as session:
            rows = session.scalars(
                select(DocumentRow)
                .where(DocumentRow.tenant_id == tenant_id)
                .order_by(DocumentRow.created_at)
            )
            return [_document(row) for row in rows]

    def add_chunk(self, chunk: Chunk) -> None:
        embedding_json = json.dumps(chunk.embedding, separators=(",", ":"))
        with self._session() as session:
            session.add(
                ChunkRow(
                    id=chunk.id,
                    tenant_id=chunk.tenant_id,
                    corpus_id=chunk.corpus_id,
                    document_id=chunk.document_id,
                    text=chunk.text,
                    embedding_json=embedding_json,
                )
            )
            session.flush()
            if self.is_postgres:
                session.execute(
                    text(
                        "UPDATE chunks SET embedding_vec = "
                        "CAST(:embedding AS vector) WHERE id = :id"
                    ),
                    {"embedding": embedding_json, "id": chunk.id},
                )

    def search(
        self,
        tenant_id: str,
        embedding: list[float],
        top_k: int,
    ) -> list[tuple[float, Chunk]]:
        embedding_json = json.dumps(embedding, separators=(",", ":"))
        with self.sessions() as session:
            if self.is_postgres:
                rows = session.execute(
                    text(
                        "SELECT id, tenant_id, corpus_id, document_id, text, "
                        "embedding_json, 1 - (embedding_vec <=> "
                        "CAST(:embedding AS vector)) AS score "
                        "FROM chunks WHERE tenant_id = :tenant_id "
                        "AND embedding_vec IS NOT NULL "
                        "ORDER BY embedding_vec <=> CAST(:embedding AS vector) "
                        "LIMIT :top_k"
                    ),
                    {
                        "embedding": embedding_json,
                        "tenant_id": tenant_id,
                        "top_k": top_k,
                    },
                ).mappings()
                return [
                    (
                        float(row["score"]),
                        _chunk_mapping(row),
                    )
                    for row in rows
                ]
            rows = session.scalars(
                select(ChunkRow).where(ChunkRow.tenant_id == tenant_id)
            )
            ranked = [
                (
                    cosine(embedding, json.loads(row.embedding_json)),
                    _chunk(row),
                )
                for row in rows
            ]
            ranked.sort(key=lambda item: item[0], reverse=True)
            return ranked[:top_k]

    def delete_corpus(self, tenant_id: str, corpus_id: str) -> int:
        with self._session() as session:
            result = session.execute(
                delete(ChunkRow).where(
                    ChunkRow.tenant_id == tenant_id,
                    ChunkRow.corpus_id == corpus_id,
                )
            )
            session.execute(
                delete(DocumentRow).where(
                    DocumentRow.tenant_id == tenant_id,
                    DocumentRow.corpus_id == corpus_id,
                )
            )
            return int(result.rowcount or 0)

    def enqueue(
        self,
        tenant_id: str,
        document_id: str,
        idempotency_key: str,
        *,
        job_id: str | None = None,
    ) -> JobRecord:
        existing = self.find_job(tenant_id, idempotency_key)
        if existing:
            return existing
        record = JobRecord(
            id=job_id or str(uuid.uuid4()),
            tenant_id=tenant_id,
            document_id=document_id,
            idempotency_key=idempotency_key,
        )
        try:
            with self._session() as session:
                session.add(_job_row(record))
        except IntegrityError:
            existing = self.find_job(tenant_id, idempotency_key)
            if existing:
                return existing
            raise
        return record

    def get_job(
        self,
        job_id: str,
        tenant_id: str | None = None,
    ) -> JobRecord | None:
        with self.sessions() as session:
            query = select(JobRow).where(JobRow.id == job_id)
            if tenant_id is not None:
                query = query.where(JobRow.tenant_id == tenant_id)
            row = session.scalar(query)
            return _job(row) if row else None

    def find_job(
        self,
        tenant_id: str,
        idempotency_key: str,
    ) -> JobRecord | None:
        with self.sessions() as session:
            row = session.scalar(
                select(JobRow).where(
                    JobRow.tenant_id == tenant_id,
                    JobRow.idempotency_key == idempotency_key,
                )
            )
            return _job(row) if row else None

    def save_job(self, job: JobRecord) -> None:
        with self._session() as session:
            row = session.get(JobRow, job.id)
            if row is None:
                session.add(_job_row(job))
                return
            row.status = job.status
            row.attempts = job.attempts
            row.error = job.error

    def remember(
        self,
        tenant_id: str,
        conversation_id: str,
        role: str,
        text_value: str,
    ) -> None:
        with self._session() as session:
            session.add(
                ConversationMessageRow(
                    tenant_id=tenant_id,
                    conversation_id=conversation_id,
                    role=role,
                    text=text_value,
                    created_at=datetime.now(UTC),
                )
            )

    def history(self, tenant_id: str, conversation_id: str) -> list[dict]:
        with self.sessions() as session:
            rows = session.scalars(
                select(ConversationMessageRow)
                .where(
                    ConversationMessageRow.tenant_id == tenant_id,
                    ConversationMessageRow.conversation_id == conversation_id,
                )
                .order_by(ConversationMessageRow.id)
            )
            return [{"role": row.role, "text": row.text} for row in rows]

    def add_usage(self, record: UsageRecord) -> None:
        with self._session() as session:
            session.add(
                UsageRow(
                    tenant_id=record.tenant_id,
                    model=record.model,
                    input_tokens=record.input_tokens,
                    output_tokens=record.output_tokens,
                    cost_usd=record.cost_usd,
                    feature=record.feature,
                    created_at=record.created_at,
                )
            )

    def list_usage(
        self,
        tenant_id: str,
        *,
        since: datetime | None = None,
    ) -> list[UsageRecord]:
        query = select(UsageRow).where(UsageRow.tenant_id == tenant_id)
        if since is not None:
            query = query.where(UsageRow.created_at >= since)
        with self.sessions() as session:
            rows = session.scalars(query.order_by(UsageRow.created_at))
            return [
                UsageRecord(
                    row.tenant_id,
                    row.model,
                    row.input_tokens,
                    row.output_tokens,
                    row.cost_usd,
                    row.feature,
                    _utc(row.created_at),
                )
                for row in rows
            ]

    def add_audit(self, record: AuditRecord) -> None:
        with self._session() as session:
            session.add(
                AuditRow(
                    tenant_id=record.tenant_id,
                    actor=record.actor,
                    action=record.action,
                    resource=record.resource,
                    metadata_json=json.dumps(
                        record.metadata,
                        separators=(",", ":"),
                    ),
                    created_at=datetime.now(UTC),
                )
            )

    def add_webhook(self, payload: dict) -> None:
        normalized = {
            key: (
                {"base64": base64.b64encode(value).decode()}
                if isinstance(value, bytes)
                else value
            )
            for key, value in payload.items()
        }
        tenant_id = str(payload.get("tenantId") or "system")
        with self._session() as session:
            session.add(
                WebhookEventRow(
                    tenant_id=tenant_id,
                    payload_json=json.dumps(normalized, separators=(",", ":")),
                    created_at=datetime.now(UTC),
                )
            )

    def save_agent_run(self, state: dict) -> None:
        _assert_safe_state(state)
        expected_version = int(state.get("_version") or 0)
        now = datetime.now(UTC)
        serialized = json.dumps(
            {key: value for key, value in state.items() if key != "_version"},
            separators=(",", ":"),
        )
        with self._session() as session:
            row = session.get(AgentRunRow, state["id"])
            if row is None:
                row = AgentRunRow(
                    id=state["id"],
                    tenant_id=state["tenantId"],
                    parent_run_id=state.get("parentRunId"),
                    kind=state["kind"],
                    status=state["status"],
                    state_json=serialized,
                    version=1,
                    created_at=_parse_datetime(state.get("createdAt")) or now,
                    updated_at=now,
                )
                session.add(row)
                state["_version"] = 1
                return
            if expected_version and row.version != expected_version:
                raise PolicyError(
                    "The agent run changed in another process. Reload and retry."
                )
            row.parent_run_id = state.get("parentRunId")
            row.status = state["status"]
            row.state_json = serialized
            row.version += 1
            row.updated_at = now
            state["_version"] = row.version

    def get_agent_run(self, tenant_id: str, run_id: str) -> dict | None:
        with self.sessions() as session:
            row = session.scalar(
                select(AgentRunRow).where(
                    AgentRunRow.id == run_id,
                    AgentRunRow.tenant_id == tenant_id,
                )
            )
            return _agent_state(row) if row else None

    def list_agent_runs(self, tenant_id: str) -> list[dict]:
        with self.sessions() as session:
            rows = session.scalars(
                select(AgentRunRow)
                .where(AgentRunRow.tenant_id == tenant_id)
                .order_by(AgentRunRow.created_at)
            )
            return [_agent_state(row) for row in rows]

    def create_approval(self, record: ApprovalRecord) -> None:
        with self._session() as session:
            session.add(
                ApprovalRow(
                    id=record.id,
                    tenant_id=record.tenant_id,
                    run_id=record.run_id,
                    tool=record.tool,
                    tool_input=record.tool_input,
                    status=record.status,
                    requested_by=record.requested_by,
                    decided_by=record.decided_by,
                    note=record.note,
                    created_at=record.created_at,
                    decided_at=record.decided_at,
                )
            )

    def get_approval(
        self,
        tenant_id: str,
        approval_id: str,
    ) -> ApprovalRecord | None:
        with self.sessions() as session:
            row = session.scalar(
                select(ApprovalRow).where(
                    ApprovalRow.id == approval_id,
                    ApprovalRow.tenant_id == tenant_id,
                )
            )
            return _approval(row) if row else None

    def list_approvals(
        self,
        tenant_id: str,
        status: str = "pending",
    ) -> list[ApprovalRecord]:
        query = select(ApprovalRow).where(
            ApprovalRow.tenant_id == tenant_id
        )
        if status != "all":
            query = query.where(ApprovalRow.status == status)
        with self.sessions() as session:
            rows = session.scalars(query.order_by(ApprovalRow.created_at))
            return [_approval(row) for row in rows]

    def decide_approval(
        self,
        tenant_id: str,
        approval_id: str,
        decision: str,
        decided_by: str,
        note: str,
    ) -> ApprovalRecord | None:
        with self._session() as session:
            decided_at = datetime.now(UTC)
            result = session.execute(
                update(ApprovalRow)
                .where(
                    ApprovalRow.id == approval_id,
                    ApprovalRow.tenant_id == tenant_id,
                    ApprovalRow.status == "pending",
                )
                .values(
                    status=decision,
                    decided_by=decided_by,
                    note=note,
                    decided_at=decided_at,
                )
            )
            if result.rowcount != 1:
                return None
            row = session.get(ApprovalRow, approval_id)
            return _approval(row)

    def add_evaluation(self, record: EvaluationRecord) -> None:
        with self._session() as session:
            session.add(
                EvaluationRow(
                    id=record.id,
                    tenant_id=record.tenant_id,
                    engine=record.engine,
                    scores_json=json.dumps(
                        record.scores,
                        separators=(",", ":"),
                    ),
                    passed=record.passed,
                    samples=record.samples,
                    created_at=record.created_at,
                )
            )

    def list_evaluations(self, tenant_id: str) -> list[EvaluationRecord]:
        with self.sessions() as session:
            rows = session.scalars(
                select(EvaluationRow)
                .where(EvaluationRow.tenant_id == tenant_id)
                .order_by(EvaluationRow.created_at)
            )
            return [
                EvaluationRecord(
                    row.id,
                    row.tenant_id,
                    row.engine,
                    json.loads(row.scores_json),
                    row.passed,
                    row.samples,
                    _utc(row.created_at),
                )
                for row in rows
            ]

    def _session(self):
        return _CommittedSession(self.sessions())


class _CommittedSession:
    def __init__(self, session: Session):
        self.session = session

    def __enter__(self) -> Session:
        return self.session

    def __exit__(self, exc_type, exc, traceback) -> None:
        try:
            if exc_type is None:
                self.session.commit()
            else:
                self.session.rollback()
        finally:
            self.session.close()


def _document(row: DocumentRow) -> DocumentRecord:
    return DocumentRecord(
        row.id,
        row.tenant_id,
        row.corpus_id,
        row.filename,
        row.text,
    )


def _chunk(row: ChunkRow) -> Chunk:
    return Chunk(
        row.id,
        row.tenant_id,
        row.corpus_id,
        row.document_id,
        row.text,
        json.loads(row.embedding_json),
    )


def _chunk_mapping(row) -> Chunk:
    return Chunk(
        row["id"],
        row["tenant_id"],
        row["corpus_id"],
        row["document_id"],
        row["text"],
        json.loads(row["embedding_json"]),
    )


def _job(row: JobRow) -> JobRecord:
    return JobRecord(
        row.id,
        row.tenant_id,
        row.document_id,
        row.idempotency_key,
        row.status,
        row.attempts,
        row.error,
    )


def _job_row(record: JobRecord) -> JobRow:
    return JobRow(
        id=record.id,
        tenant_id=record.tenant_id,
        document_id=record.document_id,
        idempotency_key=record.idempotency_key,
        status=record.status,
        attempts=record.attempts,
        error=record.error,
    )


def _approval(row: ApprovalRow) -> ApprovalRecord:
    return ApprovalRecord(
        row.id,
        row.tenant_id,
        row.run_id,
        row.tool,
        row.tool_input,
        row.requested_by,
        row.status,
        row.decided_by,
        row.note,
        _utc(row.created_at),
        _utc(row.decided_at) if row.decided_at else None,
    )


def _agent_state(row: AgentRunRow) -> dict:
    state = json.loads(row.state_json)
    state["_version"] = row.version
    return state


def _utc(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _parse_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    parsed = datetime.fromisoformat(value)
    return _utc(parsed)


def _assert_safe_state(value, path: tuple[str, ...] = ()) -> None:
    if isinstance(value, dict):
        for key, item in value.items():
            normalized = str(key).replace("-", "_").lower()
            if normalized in _SENSITIVE_STATE_KEYS:
                location = ".".join((*path, str(key)))
                raise PolicyError(
                    f"Agent state cannot persist sensitive field {location}."
                )
            _assert_safe_state(item, (*path, str(key)))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            _assert_safe_state(item, (*path, str(index)))
