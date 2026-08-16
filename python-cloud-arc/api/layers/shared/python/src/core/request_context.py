from __future__ import annotations

import os
from contextvars import ContextVar

request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)
request_origin_var: ContextVar[str | None] = ContextVar("request_origin", default=None)


def allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "*").strip() or "*"
    return [part.strip() for part in raw.split(",") if part.strip()]


def cors_allow_origin() -> str:
    allowed = allowed_origins()
    if "*" in allowed:
        return "*"
    origin = request_origin_var.get()
    if origin and origin in allowed:
        return origin
    return allowed[0]


def response_headers() -> dict[str, str]:
    rid = request_id_var.get()
    headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": cors_allow_origin(),
        "Access-Control-Allow-Headers": (
            "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token,X-Request-Id"
        ),
        "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
        "Access-Control-Max-Age": "86400",
    }
    if rid:
        headers["X-Request-Id"] = rid
    return headers
