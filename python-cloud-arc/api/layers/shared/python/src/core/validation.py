from __future__ import annotations

import json
from pydantic import BaseModel, ValidationError as PydanticValidationError

from middleware.error_handler import ValidationError


def validate_route_input(route: dict, event: dict) -> None:
    schema = route.get("body_schema")
    if not schema:
        return
    raw = event.get("body")
    if raw in (None, ""):
        payload: object = {}
    elif isinstance(raw, (dict, list)):
        payload = raw
    else:
        try:
            payload = json.loads(raw)
        except Exception as exc:
            raise ValidationError("Invalid JSON body") from exc
    if not isinstance(schema, type) or not issubclass(schema, BaseModel):
        return
    try:
        model = schema.model_validate(payload)
    except PydanticValidationError as exc:
        err = exc.errors()[0]
        loc = ".".join(str(p) for p in err.get("loc") or [])
        raise ValidationError(err.get("msg") or "Validation failed", field=loc or None) from exc
    event["_validated_body"] = model.model_dump()
