from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class DocumentRow(Base):
    __tablename__ = "documents"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    corpus_id: Mapped[str] = mapped_column(String(64), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ChunkRow(Base):
    __tablename__ = "chunks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    corpus_id: Mapped[str] = mapped_column(String(64), index=True)
    document_id: Mapped[str] = mapped_column(String(36), index=True)
    text: Mapped[str] = mapped_column(Text)
    embedding_json: Mapped[str] = mapped_column(Text)


class JobRow(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "idempotency_key",
            name="uq_jobs_tenant_idempotency",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    document_id: Mapped[str] = mapped_column(String(36))
    idempotency_key: Mapped[str] = mapped_column(String(128), index=True)
    status: Mapped[str] = mapped_column(String(32))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str] = mapped_column(Text, default="")


class UsageRow(Base):
    __tablename__ = "usage_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    model: Mapped[str] = mapped_column(String(128))
    input_tokens: Mapped[int] = mapped_column(Integer)
    output_tokens: Mapped[int] = mapped_column(Integer)
    cost_usd: Mapped[float] = mapped_column(Float)
    feature: Mapped[str] = mapped_column(String(32), default="chat")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AuditRow(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    actor: Mapped[str] = mapped_column(String(255))
    action: Mapped[str] = mapped_column(String(64))
    resource: Mapped[str] = mapped_column(String(128))
    metadata_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class AgentRunRow(Base):
    __tablename__ = "agent_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    parent_run_id: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)
    kind: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(32), index=True)
    state_json: Mapped[str] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ApprovalRow(Base):
    __tablename__ = "approvals"
    __table_args__ = (
        UniqueConstraint(
            "run_id",
            "tool",
            "status",
            name="uq_approvals_run_tool_status",
        ),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    run_id: Mapped[str] = mapped_column(String(36), index=True)
    tool: Mapped[str] = mapped_column(String(64))
    tool_input: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(16), index=True)
    requested_by: Mapped[str] = mapped_column(String(255))
    decided_by: Mapped[str] = mapped_column(String(255), default="")
    note: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EvaluationRow(Base):
    __tablename__ = "evaluations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    engine: Mapped[str] = mapped_column(String(16))
    scores_json: Mapped[str] = mapped_column(Text)
    passed: Mapped[bool] = mapped_column(Boolean)
    samples: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class ConversationMessageRow(Base):
    __tablename__ = "conversation_messages"
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    conversation_id: Mapped[str] = mapped_column(String(128), index=True)
    role: Mapped[str] = mapped_column(String(16))
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class WebhookEventRow(Base):
    __tablename__ = "webhook_events"
    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
    )
    tenant_id: Mapped[str] = mapped_column(String(64), index=True)
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
