from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import yaml


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    summary: str
    price_inr: int
    price_usd: int
    checkout_enabled: bool
    badge: str
    artifacts: tuple[str, ...]
    includes: tuple[str, ...]

    def public(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "summary": self.summary,
            "priceInr": self.price_inr,
            "priceUsd": self.price_usd,
            "checkoutEnabled": self.checkout_enabled,
            "badge": self.badge,
            "includes": list(self.includes),
        }


def load_catalog(path: Path) -> dict[str, Plan]:
    raw = yaml.safe_load(path.read_text())
    plans: dict[str, Plan] = {}
    for item in raw["plans"]:
        plan = Plan(
            id=item["id"],
            name=item["name"],
            summary=item["summary"],
            price_inr=int(item["price_inr"]),
            price_usd=int(item["price_usd"]),
            checkout_enabled=bool(item["checkout_enabled"]),
            badge=item.get("badge", ""),
            artifacts=tuple(item["artifacts"]),
            includes=tuple(item.get("includes", [])),
        )
        plans[plan.id] = plan
    return plans
