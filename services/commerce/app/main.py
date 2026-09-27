from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import UTC
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.catalog import load_catalog
from app.models import Base, Entitlement, Order
from app.payments import start_checkout, verify_razorpay, verify_stripe
from app.service import artifact_ids, create_lead, create_order, fulfill, read_artifact
from app.settings import Settings, load_settings


class LeadIn(BaseModel):
    email: str = ""
    whatsapp: str = ""
    consent: bool = False
    page: str = ""


class CheckoutIn(BaseModel):
    planId: str
    provider: str
    email: EmailStr
    name: str = Field(min_length=1, max_length=160)
    country: str = Field(min_length=2, max_length=2)


class SimulateIn(BaseModel):
    orderId: str
    provider: str


def iso_utc(value):
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.isoformat()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()
    if settings.database_url.startswith("sqlite:///"):
        sqlite_path = Path(settings.database_url.removeprefix("sqlite:///"))
        if sqlite_path.name != ":memory:":
            sqlite_path.parent.mkdir(parents=True, exist_ok=True)
    engine = create_engine(settings.database_url, future=True)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, expire_on_commit=False, future=True)
    plans = load_catalog(settings.catalog_path)
    smtp = {
        "host": settings.smtp_host,
        "port": settings.smtp_port,
        "username": settings.smtp_username,
        "password": settings.smtp_password,
        "from": settings.smtp_from,
    }

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        engine.dispose()

    app = FastAPI(title="ForgeArc Commerce", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.public_base_url, "http://127.0.0.1:4173", "http://localhost:4173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/catalog")
    def catalog():
        return {"plans": [plan.public() for plan in plans.values()]}

    @app.post("/api/leads")
    def leads(body: LeadIn):
        db = sessions()
        try:
            lead = create_lead(
                db,
                email=body.email,
                whatsapp=body.whatsapp,
                consent=body.consent,
                page=body.page,
            )
            return {"id": lead.id, "followUpStatus": lead.follow_up_status}
        finally:
            db.close()

    @app.post("/api/checkout")
    def checkout(body: CheckoutIn):
        plan = plans.get(body.planId)
        if plan is None:
            raise HTTPException(404, "Unknown plan")
        if not plan.checkout_enabled:
            raise HTTPException(409, "This plan is not open for checkout")
        provider = body.provider.lower()
        if body.country.upper() == "IN" and provider != "razorpay":
            raise HTTPException(422, "India billing uses Razorpay")
        if body.country.upper() != "IN" and provider != "stripe":
            raise HTTPException(422, "International billing uses Stripe")
        db = sessions()
        try:
            order = create_order(
                db,
                plan=plan,
                provider=provider,
                email=str(body.email),
                buyer_name=body.name,
            )
            try:
                started = start_checkout(settings, plan, order.id, provider)
            except RuntimeError as exc:
                raise HTTPException(503, str(exc)) from exc
            if started.get("providerReference"):
                order.provider_reference = started["providerReference"]
                db.commit()
            return {"orderId": order.id, **started}
        finally:
            db.close()

    @app.post("/api/checkout/simulate")
    def simulate(body: SimulateIn):
        if not settings.test_mode:
            raise HTTPException(404, "Not found")
        db = sessions()
        try:
            order = db.get(Order, body.orderId)
            if order is None or order.provider != body.provider:
                raise HTTPException(404, "Order not found")
            entitlement = fulfill(db, order, plans[order.plan_id], settings.artifact_dir, smtp)
            return {"orderId": order.id, "token": entitlement.token, "status": order.status}
        finally:
            db.close()

    @app.post("/api/webhooks/stripe")
    async def stripe_webhook(request: Request):
        payload = await request.body()
        header = request.headers.get("stripe-signature", "")
        if not verify_stripe(payload, header, settings.stripe_webhook_secret):
            raise HTTPException(400, "Invalid Stripe signature")
        event = json.loads(payload)
        if event.get("type") != "checkout.session.completed":
            return {"ok": True}
        order_id = event["data"]["object"].get("client_reference_id")
        db = sessions()
        try:
            order = db.get(Order, order_id)
            if order is None:
                raise HTTPException(404, "Order not found")
            fulfill(db, order, plans[order.plan_id], settings.artifact_dir, smtp)
            return {"ok": True}
        finally:
            db.close()

    @app.post("/api/webhooks/razorpay")
    async def razorpay_webhook(request: Request):
        payload = await request.body()
        header = request.headers.get("x-razorpay-signature", "")
        if not verify_razorpay(payload, header, settings.razorpay_webhook_secret):
            raise HTTPException(400, "Invalid Razorpay signature")
        event = json.loads(payload)
        if event.get("event") != "payment.captured":
            return {"ok": True}
        notes = event["payload"]["payment"]["entity"].get("notes") or {}
        order_id = notes.get("commerce_order_id")
        db = sessions()
        try:
            order = db.get(Order, order_id)
            if order is None:
                raise HTTPException(404, "Order not found")
            fulfill(db, order, plans[order.plan_id], settings.artifact_dir, smtp)
            return {"ok": True}
        finally:
            db.close()

    @app.get("/api/orders/{order_id}")
    def get_order(order_id: str):
        db = sessions()
        try:
            order = db.get(Order, order_id)
            if order is None:
                raise HTTPException(404, "Order not found")
            entitlement = db.scalar(select(Entitlement).where(Entitlement.order_id == order.id))
            return {
                "orderId": order.id,
                "planName": order.plan_name,
                "status": order.status,
                "currency": order.currency,
                "amount": order.amount,
                "downloadToken": entitlement.token if entitlement else None,
            }
        finally:
            db.close()

    @app.get("/api/purchases/recent")
    def recent():
        db = sessions()
        try:
            rows = db.scalars(
                select(Order).where(Order.status == "paid").order_by(Order.paid_at.desc()).limit(8)
            ).all()
            return {
                "purchases": [
                    {"planName": row.plan_name, "purchasedAt": iso_utc(row.paid_at)}
                    for row in rows
                ]
            }
        finally:
            db.close()

    @app.get("/api/downloads/{token}")
    def list_downloads(token: str):
        db = sessions()
        try:
            entitlement = db.scalar(select(Entitlement).where(Entitlement.token == token))
            if entitlement is None:
                raise HTTPException(404, "License not found")
            return {"artifacts": artifact_ids(entitlement)}
        finally:
            db.close()

    @app.get("/api/downloads/{token}/{artifact_id}")
    def download(token: str, artifact_id: str):
        db = sessions()
        try:
            entitlement = db.scalar(select(Entitlement).where(Entitlement.token == token))
            if entitlement is None:
                raise HTTPException(404, "License not found")
            if artifact_id not in artifact_ids(entitlement):
                raise HTTPException(403, "This plan does not include that artifact")
            try:
                content = read_artifact(settings.artifact_dir, artifact_id)
            except FileNotFoundError as exc:
                raise HTTPException(409, "This artifact ships with a later release") from exc
            return {"artifactId": artifact_id, "content": content}
        finally:
            db.close()

    return app


app = create_app()
