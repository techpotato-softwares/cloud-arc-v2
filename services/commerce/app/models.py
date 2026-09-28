from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)


@dataclass
class Lead:
    id: str
    email: str = ""
    whatsapp: str = ""
    consent: bool = False
    page: str = ""
    follow_up_status: str = ""
    created_at: datetime = field(default_factory=utcnow)


@dataclass
class Order:
    id: str
    plan_id: str
    plan_name: str
    provider: str
    email: str
    buyer_name: str
    amount: int
    currency: str
    status: str = "pending"
    provider_reference: str = ""
    created_at: datetime = field(default_factory=utcnow)
    paid_at: datetime | None = None


@dataclass
class Entitlement:
    id: str
    order_id: str
    token: str
    email: str
    artifacts: str


@dataclass
class EmailMessage:
    id: str
    order_id: str
    to_email: str
    subject: str
    body: str
    status: str
    created_at: datetime = field(default_factory=utcnow)
