from __future__ import annotations

import hashlib
import hmac
import json

from forgearc_ai.repositories.records import JobRecord


def sign_webhook(secret: str, body: bytes) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def webhook_body(job: JobRecord) -> bytes:
    return json.dumps(
        {
            "jobId": job.id,
            "tenantId": job.tenant_id,
            "status": job.status,
            "documentId": job.document_id,
        },
        separators=(",", ":"),
    ).encode()
