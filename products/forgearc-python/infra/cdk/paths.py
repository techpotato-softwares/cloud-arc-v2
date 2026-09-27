"""Shared path helpers for ForgeArc Python CDK."""
from __future__ import annotations

from pathlib import Path

CDK_ROOT = Path(__file__).resolve().parent
KIT_ROOT = CDK_ROOT.parents[1]
API_ROOT = KIT_ROOT / "apps" / "api"
API_ASSET_ROOT = KIT_ROOT
LAYER_BUNDLED = KIT_ROOT / "packages" / "shared" / "bundled"
MANIFEST_PATH = API_ROOT / "app-manifest.json"
ENV_LOCAL_JSON = CDK_ROOT / "env.local.json"
UI_BUILD_PATH = KIT_ROOT / "ui" / "build"

API_ASSET_EXCLUDES = [
    ".venv",
    ".venv/**",
    "apps",
    "apps/**",
    "packages",
    "packages/**",
    "infra",
    "infra/**",
    "migrations",
    "migrations/**",
    "docs",
    "docs/**",
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
