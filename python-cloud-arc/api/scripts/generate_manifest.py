#!/usr/bin/env python3
"""Merge route metadata from all modules into api/app-manifest.json for CDK.

Usage (from api/):
  python scripts/generate_manifest.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
sys.path.insert(0, str(API_ROOT / "layers" / "shared" / "python" / "src"))

from scripts.discover import import_module_registers
from scripts.modules_catalog import MODULE_CATALOG


def main() -> None:
    print("Merging manifests from modules...\n")
    import_module_registers()

    from decorators.registry import route_registry

    base = route_registry.generate_manifest()
    modules_meta: dict = {}
    for mod in MODULE_CATALOG:
        sku = mod["sku"]
        related = [
            name
            for name in base["lambdas"]
            if (sku == "platform" and name in {"auth", "user", "role", "permission"})
            or name == sku
            or name.startswith(f"{sku}-")
        ]
        modules_meta[sku] = {
            "sku": sku,
            "packageName": mod["packageName"],
            "compute": mod["compute"],
            "requiredModules": mod["requiredModules"],
            **({"required": True} if mod.get("required") else {}),
            "lambdas": related,
        }

    output = {**base, "version": "2.0", "modules": modules_meta}
    out_path = API_ROOT / "app-manifest.json"
    out_path.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")

    lambda_count = len(output["lambdas"])
    route_count = sum(len(entry["routes"]) for entry in output["lambdas"].values())
    print(f"\n✅ {out_path}")
    print(f"   Modules: {len(MODULE_CATALOG)}")
    print(f"   Lambdas: {lambda_count}")
    print(f"   Routes:  {route_count}\n")


if __name__ == "__main__":
    main()
