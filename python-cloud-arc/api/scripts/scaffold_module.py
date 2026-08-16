#!/usr/bin/env python3
"""Scaffold a new sellable module (controller/service/repo/lambda/TYPES/catalog)."""
from __future__ import annotations

import argparse
import re
from pathlib import Path

API_ROOT = Path(__file__).resolve().parents[1]


def pascal(sku: str) -> str:
    return "".join(p.title() for p in re.split(r"[-_]", sku) if p)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("sku", help="module sku, e.g. inventory")
    args = parser.parse_args()
    sku = args.sku.strip().lower()
    name = pascal(sku)
    root = API_ROOT / "modules" / sku
    for rel in (
        "lambdas",
        "src/controllers",
        "src/services",
        "src/repositories",
        "src/schemas",
        "src/types",
    ):
        (root / rel).mkdir(parents=True, exist_ok=True)
        init = root / rel / "__init__.py"
        if not init.exists():
            init.write_text("", encoding="utf-8")
    (root / "__init__.py").write_text("", encoding="utf-8")
    (root / "src" / "__init__.py").write_text("", encoding="utf-8")

    types_path = root / "src/types/svc_types.py"
    if not types_path.exists():
        types_path.write_text(
            f'class TYPES:\n    SessionFactory = "SessionFactory"\n    {name}Service = "{name}Service"\n    {name}Repository = "{name}Repository"\n',
            encoding="utf-8",
        )
    readme = root / "README.md"
    if not readme.exists():
        readme.write_text(
            f"# ArcForge `{sku}` module\n\nCopy demo CSR: Controller → Service → Repository.\nSee docs/CSR-AND-DI.md.\n",
            encoding="utf-8",
        )
    catalog = API_ROOT / "scripts/modules_catalog.py"
    text = catalog.read_text(encoding="utf-8")
    if f'"sku": "{sku}"' not in text:
        entry = f'''    {{
        "sku": "{sku}",
        "packageName": "arcforge-module-{sku}",
        "path": "modules/{sku}",
        "compute": "lambda",
        "requiredModules": ["platform"],
    }},
'''
        text = text.replace("]\n", entry + "]\n", 1)
        catalog.write_text(text, encoding="utf-8")
        print(f"Added {sku} to scripts/modules_catalog.py")
    print(f"Scaffolded modules/{sku} — add controller/service/repo/lambda and register in src/dev_server.py")


if __name__ == "__main__":
    main()
