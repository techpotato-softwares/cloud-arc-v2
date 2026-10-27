"""SQS and API entrypoints for the ForgeArc AI Lambda assets."""

from __future__ import annotations

import json

from forgearc_ai_api.app import create_app

_mangum = None


def handler(event, _context):
    container = create_app().state.container
    ingestion = container.get("IngestionService")
    failures = []
    for record in event.get("Records", []):
        body = record.get("body") or ""
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = body
        try:
            ingestion.process_message(payload)
        except Exception:
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


def api_handler(event, context):
    global _mangum
    if _mangum is None:
        from mangum import Mangum
        from forgearc_ai_api.app import app as asgi_app

        _mangum = Mangum(asgi_app, lifespan="off")
    return _mangum(event, context)
