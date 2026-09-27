#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRODUCT="$ROOT/products/forgearc-python"
RELEASES="$ROOT/releases"
VERSION="${1:-2.0.0}"
NAME="forgearc-python-$VERSION"
TMP="$(mktemp -d)"
STAGE="$TMP/$NAME"
trap 'rm -rf "$TMP"' EXIT

uv --directory "$ROOT" run pytest products/forgearc-python/apps/api/tests
uv --directory "$ROOT" run --package forgearc-python-api \
  python products/forgearc-python/apps/api/scripts/generate_manifest.py
uv --directory "$ROOT" run --package forgearc-python-api \
  python products/forgearc-python/apps/api/scripts/generate_openapi.py

mkdir -p "$STAGE" "$RELEASES"
rsync -a \
  --exclude '.env*' --exclude '.venv' --exclude '__pycache__' \
  --exclude '*.pyc' --exclude 'bundled' --exclude 'cdk.out' \
  --exclude '.pytest_cache' --exclude '.ruff_cache' --exclude '.DS_Store' \
  "$PRODUCT/" "$STAGE/"

cat > "$STAGE/pyproject.toml" <<EOF
[project]
name = "forgearc-python"
version = "$VERSION"
description = "Standalone ForgeArc Python product"
requires-python = ">=3.12"
dependencies = ["forgearc-python-api", "forgearc-python-cdk"]

[tool.uv]
package = false

[tool.uv.sources]
forgearc-python-api = { workspace = true }
forgearc-python-cdk = { workspace = true }

[tool.uv.workspace]
members = [
  "apps/api",
  "packages/shared",
  "modules/platform",
  "modules/demo",
  "modules/ai",
  "modules/files",
  "infra/cdk",
]

[dependency-groups]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "ruff>=0.5"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = [".", "apps/api", "packages/shared/src"]
EOF

(
  cd "$STAGE"
  uv lock
  uv sync --all-packages --frozen
  uv run --package forgearc-python-api pytest apps/api/tests
  uv run --package forgearc-python-api python apps/api/scripts/generate_manifest.py
  uv run --package forgearc-python-api python apps/api/scripts/generate_openapi.py
  uv run --package forgearc-python-api python packages/shared/scripts/build_layer.py
)

rm -rf "$STAGE/.venv" "$STAGE/packages/shared/bundled"
find "$STAGE" -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} +
find "$STAGE" -name '*.pyc' -delete
find "$STAGE" -exec touch -t 202001010000 {} +
rm -f "$RELEASES/$NAME.zip"
(
  cd "$TMP"
  find "$NAME" -type f -print | LC_ALL=C sort | zip -X -q "$RELEASES/$NAME.zip" -@
)
echo "$RELEASES/$NAME.zip"
