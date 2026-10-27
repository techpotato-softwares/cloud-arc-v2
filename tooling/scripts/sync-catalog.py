"""Write the marketing catalog snapshot from packages/commercial-catalog/catalog.yaml."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "services" / "commerce"))

from app.catalog import load_catalog  # noqa: E402


def main() -> None:
    plans = load_catalog(ROOT / "packages" / "commercial-catalog" / "catalog.yaml")
    target = ROOT / "apps" / "marketing" / "src" / "catalog.json"
    payload = {"plans": [plan.public() for plan in plans.values()]}
    target.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(plans)} plans to {target.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
