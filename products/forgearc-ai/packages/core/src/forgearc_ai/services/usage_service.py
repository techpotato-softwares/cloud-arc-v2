from __future__ import annotations

from calendar import monthrange
from datetime import UTC, datetime, timedelta

from forgearc_ai.auth import Principal
from forgearc_ai.config import Settings
from forgearc_ai.repositories import Repository, UsageRecord


class UsageService:
    def __init__(
        self,
        repository: Repository,
        settings: Settings | None = None,
    ):
        self.repository = repository
        self.settings = settings

    def summary(self, principal: Principal) -> dict:
        rows = self.repository.list_usage(principal.tenant_id)
        return {
            "calls": len(rows),
            "inputTokens": sum(row.input_tokens for row in rows),
            "outputTokens": sum(row.output_tokens for row in rows),
            "costUsd": sum(row.cost_usd for row in rows),
            "models": sorted({row.model for row in rows}),
        }

    def dashboard(self, principal: Principal, query: dict) -> dict:
        days = min(365, max(1, int(query.get("days") or 30)))
        now = datetime.now(UTC)
        since = (now - timedelta(days=days - 1)).date()
        tenant_rows = self.repository.list_usage(principal.tenant_id)
        rows = [
            row for row in tenant_rows if row.created_at.date() >= since
        ]
        month_rows = [
            row
            for row in tenant_rows
            if (row.created_at.year, row.created_at.month)
            == (now.year, now.month)
        ]
        month_spend = sum(row.cost_usd for row in month_rows)
        days_in_month = monthrange(now.year, now.month)[1]
        limit = self.settings.budget.monthly_usd if self.settings else 0.0
        by_day = {
            since + timedelta(days=offset): {"calls": 0, "costUsd": 0.0}
            for offset in range(days)
        }
        for row in rows:
            bucket = by_day[row.created_at.date()]
            bucket["calls"] += 1
            bucket["costUsd"] += row.cost_usd
        runs = self.repository.list_agent_runs(principal.tenant_id)
        return {
            "days": days,
            "totals": _totals(rows),
            "budget": {
                "monthlyUsd": limit,
                "spentUsd": month_spend,
                "remainingUsd": max(0.0, limit - month_spend),
                "percentUsed": (
                    round(100 * month_spend / limit, 2) if limit else 0.0
                ),
                "projectedUsd": month_spend / now.day * days_in_month,
            },
            "byModel": _grouped(rows, lambda row: row.model, "model"),
            "byFeature": _grouped(rows, lambda row: row.feature, "feature"),
            "byDay": [
                {"date": day.isoformat(), **values}
                for day, values in by_day.items()
            ],
            "agents": {
                "runs": len(runs),
                "awaitingApproval": sum(
                    1
                    for run in runs
                    if run["status"] == "awaiting_approval"
                ),
            },
        }


def _totals(rows: list[UsageRecord]) -> dict:
    return {
        "calls": len(rows),
        "inputTokens": sum(row.input_tokens for row in rows),
        "outputTokens": sum(row.output_tokens for row in rows),
        "costUsd": sum(row.cost_usd for row in rows),
    }


def _grouped(rows: list[UsageRecord], key, label: str) -> list[dict]:
    groups: dict[str, list[UsageRecord]] = {}
    for row in rows:
        groups.setdefault(key(row), []).append(row)
    ranked = [
        {label: name, **_totals(items)}
        for name, items in groups.items()
    ]
    return sorted(ranked, key=lambda item: item["costUsd"], reverse=True)
