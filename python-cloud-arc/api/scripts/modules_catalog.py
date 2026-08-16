from __future__ import annotations

from typing import Any

MODULE_CATALOG: list[dict[str, Any]] = [
    {
        "sku": "platform",
        "packageName": "arcforge-module-platform",
        "path": "modules/platform",
        "compute": "lambda",
        "requiredModules": [],
        "required": True,
    },
    {
        "sku": "demo",
        "packageName": "arcforge-module-demo",
        "path": "modules/demo",
        "compute": "lambda",
        "requiredModules": ["platform"],
    },
    {
        "sku": "ai",
        "packageName": "arcforge-module-ai",
        "path": "modules/ai",
        "compute": "lambda",
        "requiredModules": ["platform"],
    },
    {
        "sku": "files",
        "packageName": "arcforge-module-files",
        "path": "modules/files",
        "compute": "lambda",
        "requiredModules": ["platform"],
    },
]
