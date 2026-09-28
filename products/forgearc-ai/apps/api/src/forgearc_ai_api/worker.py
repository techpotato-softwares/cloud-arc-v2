"""SQS and API entrypoints for the ForgeArc AI Lambda assets."""

from __future__ import annotations

from forgearc_ai_api.app import create_app


def handler(event, _context):
    container = create_app().state.container
    ingestion = container.get("IngestionService")
    failures = []
    for record in event.get("Records", []):
        job_id = record.get("body")
        try:
            ingestion.process(job_id)
        except Exception:
            failures.append({"itemIdentifier": record.get("messageId")})
    return {"batchItemFailures": failures}


def api_handler(event, context):
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": '{"service":"forgearc-ai"}',
    }
