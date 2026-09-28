from __future__ import annotations

import re

EMAIL = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE = re.compile(r"\b\+?\d[\d\s\-()]{8,}\d\b")
SECRET = re.compile(r"\b(?:sk|rk|ak|jev)-[A-Za-z0-9_\-]{8,}\b")


def redact(value: str) -> str:
    value = EMAIL.sub("[email]", value)
    value = SECRET.sub("[secret]", value)
    return PHONE.sub("[phone]", value)
