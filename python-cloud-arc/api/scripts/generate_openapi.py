#!/usr/bin/env python3
"""Generate OpenAPI 3.1 from Pydantic schemas + decorator route metadata.

Usage (from api/):
  python scripts/generate_openapi.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(API_ROOT))
sys.path.insert(0, str(API_ROOT / "layers" / "shared" / "python" / "src"))

from scripts.discover import import_module_registers


def main() -> None:
    print("Generating OpenAPI from route registry...")
    import_module_registers()

    from core.openapi import generate_openapi_json, generate_openapi_yaml

    options = {
        "title": "ArcForge API",
        "version": "0.1.0",
        "description": "Generated from Pydantic schemas and @Controller route metadata",
    }
    out_dir = API_ROOT / "openapi"
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "openapi.json"
    yaml_path = out_dir / "openapi.yaml"
    json_path.write_text(generate_openapi_json(**options) + "\n", encoding="utf-8")
    yaml_path.write_text(generate_openapi_yaml(**options), encoding="utf-8")

    doc = json.loads(json_path.read_text(encoding="utf-8"))
    path_count = len(doc.get("paths") or {})
    print(f"✓ Wrote {yaml_path} ({path_count} paths)")
    print(f"✓ Wrote {json_path}")


if __name__ == "__main__":
    main()
