from __future__ import annotations

import json

from forgearc_ai.errors import ProviderError


def parse_structured(text: str) -> dict:
    """Read a JSON object from a model reply, tolerating code fences and surrounding prose."""
    body = text.strip()
    if body.startswith("```"):
        body = body.strip("`").removeprefix("json").strip()
    start, end = body.find("{"), body.rfind("}")
    if start == -1 or end < start:
        raise ProviderError("The model did not return a JSON object.")
    try:
        value = json.loads(body[start : end + 1])
    except json.JSONDecodeError as exc:
        raise ProviderError("The model returned malformed JSON.") from exc
    if not isinstance(value, dict):
        raise ProviderError("The model did not return a JSON object.")
    return value


def schema_instructions(schema: dict) -> str:
    fields = []
    for name, spec in (schema.get("properties") or {}).items():
        options = spec.get("enum")
        fields.append(f'"{name}": one of {json.dumps(options)}' if options else f'"{name}": {spec.get("type", "string")}')
    return "Reply with one JSON object only, with these fields: " + "; ".join(fields) + "."
