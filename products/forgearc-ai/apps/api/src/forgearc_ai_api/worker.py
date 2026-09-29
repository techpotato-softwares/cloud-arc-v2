"""SQS and API entrypoints for the ForgeArc AI Lambda assets."""

from __future__ import annotations

import json

from forgearc_ai_api.app import create_app


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
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": '{"service":"forgearc-ai"}',
    }
