from __future__ import annotations

import json
import smtplib
import uuid
from email.message import EmailMessage as SmtpEmail
from pathlib import Path

from app.catalog import Plan
from app.models import EmailMessage, Entitlement, Lead, Order, utcnow
from app.store import DynamoCommerceStore, MemoryCommerceStore

CommerceStore = MemoryCommerceStore | DynamoCommerceStore


def new_id() -> str:
    return str(uuid.uuid4())


def create_lead(store: CommerceStore, *, email: str, whatsapp: str, consent: bool, page: str) -> Lead:
    can_follow = consent and bool(email or whatsapp)
    lead = Lead(
        id=new_id(),
        email=email.strip(),
        whatsapp=whatsapp.strip(),
        consent=consent,
        page=page.strip(),
        follow_up_status="queued" if can_follow else "skipped_no_consent",
    )
    store.put_lead(lead)
    return lead


def create_order(
    store: CommerceStore,
    *,
    plan: Plan,
    provider: str,
    email: str,
    buyer_name: str,
) -> Order:
    currency = "INR" if provider == "razorpay" else "USD"
    amount = plan.price_inr if currency == "INR" else plan.price_usd
    order = Order(
        id=new_id(),
        plan_id=plan.id,
        plan_name=plan.name,
        provider=provider,
        email=email.strip(),
        buyer_name=buyer_name.strip(),
        amount=amount,
        currency=currency,
        status="pending",
    )
    store.put_order(order)
    return order


def fulfill(
    store: CommerceStore, order: Order, plan: Plan, artifact_dir: Path, smtp: dict
) -> Entitlement:
    existing = store.get_entitlement_by_order(order.id)
    if existing:
        return existing
    order.status = "paid"
    order.paid_at = utcnow()
    store.save_order(order)
    entitlement = Entitlement(
        id=new_id(),
        order_id=order.id,
        token=uuid.uuid4().hex,
        email=order.email,
        artifacts=json.dumps(list(plan.artifacts)),
    )
    store.put_entitlement(entitlement)
    message = _queue_email(store, order, plan, entitlement)
    _send_email(message, smtp)
    store.save_email(message)
    return entitlement


def _queue_email(
    store: CommerceStore, order: Order, plan: Plan, entitlement: Entitlement
) -> EmailMessage:
    steps = "\n".join(f"- {item}" for item in plan.includes)
    body = (
        f"Hello {order.buyer_name},\n\n"
        f"Your {plan.name} purchase is confirmed.\n"
        f"License token: {entitlement.token}\n"
        f"This token opens only the artifacts in this plan. "
        f"Paid kits are delivered as a private repository invite bound to {order.email}, "
        f"not as a public download of the source.\n\n"
        f"Included:\n{steps}\n\n"
        "Setup order:\n"
        "1. Open the private invite from this mailbox.\n"
        "2. Copy the kit into a private repository.\n"
        "3. Follow the setup guide attached to this license.\n"
        "4. Set secrets in the host environment before the first deploy.\n"
    )
    message = EmailMessage(
        id=new_id(),
        order_id=order.id,
        to_email=order.email,
        subject=f"Your {plan.name} license and setup steps",
        body=body,
        status="stored",
    )
    store.put_email(message)
    return message


def _send_email(message: EmailMessage, smtp: dict) -> None:
    if smtp.get("ses_region"):
        import boto3

        boto3.client("sesv2", region_name=smtp["ses_region"]).send_email(
            FromEmailAddress=smtp["from"],
            Destination={"ToAddresses": [message.to_email]},
            Content={
                "Simple": {
                    "Subject": {"Data": message.subject},
                    "Body": {"Text": {"Data": message.body}},
                }
            },
        )
        message.status = "sent"
        return
    if not smtp.get("host"):
        return
    mail = SmtpEmail()
    mail["From"] = smtp["from"]
    mail["To"] = message.to_email
    mail["Subject"] = message.subject
    mail.set_content(message.body)
    with smtplib.SMTP(smtp["host"], smtp["port"]) as client:
        client.starttls()
        if smtp.get("username"):
            client.login(smtp["username"], smtp["password"])
        client.send_message(mail)
    message.status = "sent"


def artifact_ids(entitlement: Entitlement) -> list[str]:
    return json.loads(entitlement.artifacts)


def read_artifact(artifact_dir: Path, artifact_id: str) -> str:
    path = artifact_dir / f"{artifact_id}.md"
    if not path.is_file():
        raise FileNotFoundError(artifact_id)
    return path.read_text()
