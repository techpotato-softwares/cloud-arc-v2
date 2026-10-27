from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


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
    feature: str = "chat"
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class AuditRecord:
    tenant_id: str
    actor: str
    action: str
    resource: str
    metadata: dict


@dataclass
class ApprovalRecord:
    id: str
    tenant_id: str
    run_id: str
    tool: str
    tool_input: str
    requested_by: str
    status: str = "pending"
    decided_by: str = ""
    note: str = ""
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    decided_at: datetime | None = None

    def public(self) -> dict:
        return {
            "approvalId": self.id,
            "runId": self.run_id,
            "tool": self.tool,
            "input": self.tool_input,
            "status": self.status,
            "requestedBy": self.requested_by,
            "decidedBy": self.decided_by,
            "note": self.note,
            "createdAt": self.created_at.isoformat(),
            "decidedAt": (
                self.decided_at.isoformat() if self.decided_at else None
            ),
        }


@dataclass
class EvaluationRecord:
    id: str
    tenant_id: str
    engine: str
    scores: dict[str, float]
    passed: bool
    samples: int
    created_at: datetime = field(default_factory=lambda: datetime.now(UTC))

    def public(self) -> dict:
        return {
            "evaluationId": self.id,
            "engine": self.engine,
            "scores": self.scores,
            "passed": self.passed,
            "samples": self.samples,
            "createdAt": self.created_at.isoformat(),
        }
