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
    family: str
    tier: str
    recommended: bool
    license_scope: str
    updates: str
    excludes: tuple[str, ...]

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
            "family": self.family,
            "tier": self.tier,
            "recommended": self.recommended,
            "licenseScope": self.license_scope,
            "updates": self.updates,
            "excludes": list(self.excludes),
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
            family=item.get("family", item["id"]),
            tier=item.get("tier", "Source license"),
            recommended=bool(item.get("recommended", False)),
            license_scope=item.get("license_scope", "One organization"),
            updates=item.get("updates", "12 months"),
            excludes=tuple(item.get("excludes", [])),
        )
        plans[plan.id] = plan
    return plans


def public_catalog(plans: dict[str, Plan]) -> dict:
    families: dict[str, list[dict]] = {}
    for plan in plans.values():
        families.setdefault(plan.family, []).append(plan.public())
    return {
        "plans": [plan.public() for plan in plans.values()],
        "families": [
            {"id": family, "plans": grouped}
            for family, grouped in families.items()
        ],
    }
