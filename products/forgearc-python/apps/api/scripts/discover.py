"""Import sellable module lambdas so @Controller routes register."""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

from scripts.modules_catalog import MODULE_CATALOG

API_ROOT = Path(__file__).resolve().parents[1]
PRODUCT_ROOT = Path(__file__).resolve().parents[3]


def ensure_sys_path() -> None:
    shared = PRODUCT_ROOT / "packages" / "shared" / "src"
    for path in (str(API_ROOT), str(PRODUCT_ROOT), str(shared)):
        if path not in sys.path:
            sys.path.insert(0, path)


def import_module_registers() -> None:
    ensure_sys_path()
    from decorators.registry import route_registry

    route_registry.clear()

    for mod in MODULE_CATALOG:
        lambdas_dir = PRODUCT_ROOT / mod["path"] / "lambdas"
        if not lambdas_dir.is_dir():
            print(f"  ○ {mod['sku']} (no lambdas/)")
            continue
        imported = False
        for py in sorted(lambdas_dir.glob("*.py")):
            if py.name.startswith("_"):
                continue
            module_name = f"modules.{mod['sku']}.lambdas.{py.stem}"
            importlib.import_module(module_name)
            imported = True
        print(f"  {'✓' if imported else '○'} {mod['sku']}")
