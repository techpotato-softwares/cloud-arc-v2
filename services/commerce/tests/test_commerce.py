from __future__ import annotations

import json
import time

from app.main import create_app
from app.payments import razorpay_signature, stripe_signature
from app.settings import Settings
from fastapi.testclient import TestClient


def build_client(tmp_path, catalog_path) -> TestClient:
    settings = Settings(
        test_mode=True,
        table_name="",
        public_base_url="http://127.0.0.1:4173",
        catalog_path=catalog_path,
        artifact_dir=catalog_path.parents[2] / "services" / "commerce" / "artifacts",
        stripe_secret_key="",
        stripe_webhook_secret="whsec_test",
        razorpay_key_id="",
        razorpay_key_secret="",
        razorpay_webhook_secret="rzp_test",
        smtp_host="",
        smtp_port=587,
        smtp_username="",
        smtp_password="",
        smtp_from="ForgeArc <hello@forgearc.dev>",
    )
    return TestClient(create_app(settings))


def catalog_path():
    from pathlib import Path

    return (
        Path(__file__).resolve().parents[3]
        / "packages"
        / "commercial-catalog"
        / "catalog.yaml"
    )


def test_closed_plan_cannot_be_purchased(tmp_path):
    client = build_client(tmp_path, catalog_path())
    response = client.post(
        "/api/checkout",
        json={
            "planId": "professional",
            "provider": "stripe",
            "email": "buyer@example.com",
            "name": "Asha",
            "country": "US",
        },
    )
    assert response.status_code == 409


def test_catalog_groups_pricing_without_changing_checkout_ids(tmp_path):
    client = build_client(tmp_path, catalog_path())
    payload = client.get("/api/catalog").json()
    plans = {plan["id"]: plan for plan in payload["plans"]}
    families = {family["id"]: family for family in payload["families"]}

    assert {"node", "python", "ai", "bundle"} <= set(families)
    assert plans["forgearc-node"]["family"] == "node"
    assert plans["starter-aws"]["checkoutEnabled"] is True
    assert plans["starter-gcp"]["checkoutEnabled"] is True
    assert plans["professional"]["checkoutEnabled"] is False
    assert plans["forgearc-bundle"]["recommended"] is True
    assert plans["forgearc-node"]["priceInr"] == 28999


def test_aws_starter_checkout_is_open(tmp_path):
    client = build_client(tmp_path, catalog_path())
    response = client.post(
        "/api/checkout",
        json={
            "planId": "starter-aws",
            "provider": "stripe",
            "email": "buyer@example.com",
            "name": "Asha",
            "country": "US",
        },
    )
    assert response.status_code == 200
    assert response.json()["mode"] == "test"


def test_stripe_payment_grants_only_python_artifacts(tmp_path):
    client = build_client(tmp_path, catalog_path())
    created = client.post(
        "/api/checkout",
        json={
            "planId": "forgearc-python",
            "provider": "stripe",
            "email": "python@example.com",
            "name": "Meera",
            "country": "US",
        },
    )
    assert created.status_code == 200
    order_id = created.json()["orderId"]
    payload = json.dumps(
        {
            "id": "evt_1",
            "type": "checkout.session.completed",
            "data": {"object": {"client_reference_id": order_id}},
        }
    ).encode()
    header = stripe_signature(payload, "whsec_test", int(time.time()))
    paid = client.post("/api/webhooks/stripe", content=payload, headers={"stripe-signature": header})
    assert paid.status_code == 200

    order = client.get(f"/api/orders/{order_id}").json()
    token = order["downloadToken"]
    listed = client.get(f"/api/downloads/{token}").json()["artifacts"]
    assert listed == ["python-kit", "python-setup"]
    blocked = client.get(f"/api/downloads/{token}/node-kit")
    assert blocked.status_code == 403
    guide = client.get(f"/api/downloads/{token}/python-setup")
    assert "uv run --package forgearc-python-api alembic" in guide.json()["content"]

    recent = client.get("/api/purchases/recent").json()["purchases"]
    assert recent[0]["planName"] == "ForgeArc Python"
    assert "email" not in recent[0]


def test_razorpay_payment_sends_onboarding_and_rejects_bad_signature(tmp_path):
    client = build_client(tmp_path, catalog_path())
    created = client.post(
        "/api/checkout",
        json={
            "planId": "forgearc-node",
            "provider": "razorpay",
            "email": "node@example.com",
            "name": "Arun",
            "country": "IN",
        },
    )
    assert created.status_code == 200
    order_id = created.json()["orderId"]
    payload = json.dumps(
        {
            "event": "payment.captured",
            "payload": {"payment": {"entity": {"notes": {"commerce_order_id": order_id}}}},
        }
    ).encode()
    rejected = client.post(
        "/api/webhooks/razorpay",
        content=payload,
        headers={"x-razorpay-signature": "nope"},
    )
    assert rejected.status_code == 400
    header = razorpay_signature(payload, "rzp_test")
    paid = client.post(
        "/api/webhooks/razorpay",
        content=payload,
        headers={"x-razorpay-signature": header},
    )
    assert paid.status_code == 200
    mail = client.app.state.store.email_for("node@example.com")
    assert mail is not None
    assert "private repository invite" in mail.body
    assert "ForgeArc Node" in mail.subject


def test_follow_up_requires_consent(tmp_path):
    client = build_client(tmp_path, catalog_path())
    skipped = client.post(
        "/api/leads",
        json={"email": "quiet@example.com", "whatsapp": "919800000000", "consent": False, "page": "/"},
    )
    queued = client.post(
        "/api/leads",
        json={"email": "yes@example.com", "whatsapp": "919800000001", "consent": True, "page": "/pricing"},
    )
    assert skipped.json()["followUpStatus"] == "skipped_no_consent"
    assert queued.json()["followUpStatus"] == "queued"
