#!/usr/bin/env python3
"""Build the Python Lambda layer from the frozen uv workspace lock."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import tomllib
from pathlib import Path

LAYER = Path(__file__).resolve().parents[1]
OUT = LAYER / "bundled" / "python"

def find_workspace_root() -> Path:
    for directory in Path(__file__).resolve().parents:
        config = directory / "pyproject.toml"
        if config.exists():
            data = tomllib.loads(config.read_text())
            if "workspace" in data.get("tool", {}).get("uv", {}):
                return directory
    raise RuntimeError("Unable to locate the uv workspace root")

def main():
    workspace_root = find_workspace_root()
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    # Copy shared source
    src = LAYER / "src"
    for name in ("config", "database", "decorators", "core", "middleware", "utils"):
        shutil.copytree(src / name, OUT / name)
    # Export only the shared runtime closure. The shared workspace source is
    # copied above and product modules are shipped in each Lambda asset.
    with tempfile.NamedTemporaryFile(suffix=".txt") as requirements:
        subprocess.check_call([
            "uv", "--quiet", "export", "--frozen", "--package", "forgearc-python-shared",
            "--no-dev", "--no-emit-package", "forgearc-python-shared",
            "--format", "requirements-txt", "--output-file", requirements.name,
        ], cwd=workspace_root)
        subprocess.check_call([
            "uv", "--quiet", "pip", "install", "--python-platform", "aarch64-manylinux_2_28",
            "--python-version", "3.12", "--target", str(OUT),
            "--only-binary", ":all:",
            "--requirements", requirements.name,
        ], cwd=workspace_root)
    print(f"Layer built at {OUT}")

if __name__ == "__main__":
    main()
