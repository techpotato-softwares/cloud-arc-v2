from __future__ import annotations

import hashlib
import hmac
from urllib.parse import urlencode

import httpx

from app.catalog import Plan
from app.settings import Settings


def stripe_signature(payload: bytes, secret: str, timestamp: int) -> str:
    signed = f"{timestamp}.".encode() + payload
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def verify_stripe(payload: bytes, header: str, secret: str) -> bool:
    if not header or not secret:
        return False
    parts: dict[str, str] = {}
    for item in header.split(","):
        key, _, value = item.partition("=")
        parts[key] = value
    timestamp = parts.get("t")
    received = parts.get("v1")
    if not timestamp or not received:
        return False
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


def razorpay_signature(payload: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def verify_razorpay(payload: bytes, header: str, secret: str) -> bool:
    if not header or not secret:
        return False
    expected = razorpay_signature(payload, secret)
    return hmac.compare_digest(expected, header)


def start_checkout(settings: Settings, plan: Plan, order_id: str, provider: str) -> dict:
    if provider == "stripe":
        return _stripe(settings, plan, order_id)
    if provider == "razorpay":
        return _razorpay(settings, plan, order_id)
    raise ValueError("unsupported provider")


def _test_checkout(settings: Settings, order_id: str, provider: str) -> dict:
    query = urlencode({"order": order_id, "provider": provider})
    return {
        "mode": "test",
        "url": f"{settings.public_base_url}/checkout/test?{query}",
    }


def _stripe(settings: Settings, plan: Plan, order_id: str) -> dict:
    if settings.test_mode and not settings.stripe_secret_key:
        return _test_checkout(settings, order_id, "stripe")
    if not settings.stripe_secret_key:
        raise RuntimeError("Stripe is not configured")
    body = {
        "mode": "payment",
        "success_url": f"{settings.public_base_url}/thanks?order={order_id}",
        "cancel_url": f"{settings.public_base_url}/pricing",
        "client_reference_id": order_id,
        "line_items[0][quantity]": "1",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][unit_amount]": str(plan.price_usd * 100),
        "line_items[0][price_data][product_data][name]": plan.name,
    }
    response = httpx.post(
        "https://api.stripe.com/v1/checkout/sessions",
        data=body,
        auth=(settings.stripe_secret_key, ""),
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    return {"mode": "live", "url": payload["url"], "providerReference": payload["id"]}


def _razorpay(settings: Settings, plan: Plan, order_id: str) -> dict:
    if settings.test_mode and not settings.razorpay_key_id:
        return _test_checkout(settings, order_id, "razorpay")
    if not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise RuntimeError("Razorpay is not configured")
    response = httpx.post(
        "https://api.razorpay.com/v1/orders",
        json={
            "amount": plan.price_inr * 100,
            "currency": "INR",
            "receipt": order_id,
            "notes": {"commerce_order_id": order_id},
        },
        auth=(settings.razorpay_key_id, settings.razorpay_key_secret),
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    return {
        "mode": "live",
        "url": f"{settings.public_base_url}/checkout/razorpay?order={order_id}",
        "providerReference": payload["id"],
        "razorpayKeyId": settings.razorpay_key_id,
        "amount": plan.price_inr * 100,
        "currency": "INR",
    }
