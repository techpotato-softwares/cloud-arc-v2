"""Shared path helpers for ArcForge Python CDK."""
from __future__ import annotations

from pathlib import Path

# python-cloud-arc/cdk/
CDK_ROOT = Path(__file__).resolve().parent
# python-cloud-arc/
KIT_ROOT = CDK_ROOT.parent
# python-cloud-arc/api/
API_ROOT = KIT_ROOT / "api"
LAYER_BUNDLED = API_ROOT / "layers" / "shared" / "python" / "bundled"
MANIFEST_PATH = API_ROOT / "app-manifest.json"
ENV_LOCAL_JSON = CDK_ROOT / "env.local.json"
UI_BUILD_PATH = KIT_ROOT / "ui" / "build"

API_ASSET_EXCLUDES = [
    ".venv",
    ".venv/**",
    "layers",
    "layers/**",
    "tests",
    "tests/**",
    "scripts",
    "scripts/**",
    "alembic",
    "alembic/**",
    "**/__pycache__",
    "**/*.pyc",
    "**/.pytest_cache",
    "*.md",
    ".git",
    ".git/**",
    ".env*",
    "*.log",
    "openapi",
    "openapi/**",
]
