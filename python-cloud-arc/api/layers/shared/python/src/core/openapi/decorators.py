from __future__ import annotations
from typing import Any
from pydantic import BaseModel


def _pending(fn, **kwargs):
    pending = getattr(fn, "__route_pending__", {})
    openapi = {**(pending.get("openapi") or {}), **(kwargs.pop("openapi", None) or {})}
    pending.update(kwargs)
    if openapi:
        pending["openapi"] = openapi
    fn.__route_pending__ = pending
    for route in getattr(fn, "__route_defs__", []):
        route_oa = {**(route.get("openapi") or {}), **(openapi or {})}
        route.update(kwargs)
        if route_oa:
            route["openapi"] = route_oa
    return fn


def ApiBody(schema: type[BaseModel]):
    def deco(fn):
        return _pending(fn, body_schema=schema)
    return deco


def ApiQuery(schema: type[BaseModel]):
    def deco(fn):
        return _pending(fn, query_schema=schema)
    return deco


def OpenApiResponse(status: int, schema: type[BaseModel]):
    def deco(fn):
        existing = getattr(fn, "__route_pending__", {}).get("responses") or {}
        return _pending(fn, responses={**existing, status: schema})
    return deco


def ApiTags(*tags: str):
    def deco(fn):
        return _pending(fn, openapi={"tags": list(tags)})
    return deco


def ApiOperation(*, summary: str | None = None, operation_id: str | None = None):
    def deco(fn):
        patch: dict[str, Any] = {}
        if summary:
            patch["summary"] = summary
        if operation_id:
            patch["operationId"] = operation_id
        return _pending(fn, openapi=patch)
    return deco
