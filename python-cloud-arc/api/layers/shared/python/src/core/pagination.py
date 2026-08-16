from __future__ import annotations

import math
from typing import Any


def parse_list_query(qs: dict[str, Any] | None, *, default_limit: int = 20) -> dict[str, Any]:
    qs = qs or {}

    def _int(name: str, default: int) -> int:
        raw = qs.get(name)
        if raw in (None, ""):
            return default
        try:
            return int(raw)
        except (TypeError, ValueError):
            return default

    page = max(1, _int("page", 1))
    limit = min(100, max(1, _int("limit", default_limit)))
    sort_order = str(qs.get("sortOrder") or "DESC").upper()
    if sort_order not in ("ASC", "DESC"):
        sort_order = "DESC"
    return {
        "page": page,
        "limit": limit,
        "sortBy": qs.get("sortBy") or "created_at",
        "sortOrder": sort_order,
        "searchKey": qs.get("searchKey") or None,
        "searchTerm": qs.get("searchTerm") or None,
        "isActive": None
        if qs.get("isActive") in (None, "")
        else str(qs.get("isActive")).lower() == "true",
    }


def pagination_meta(page: int, limit: int, total: int) -> dict[str, int]:
    return {
        "page": page,
        "limit": limit,
        "total": total,
        "totalPages": math.ceil(total / limit) if limit else 0,
    }
