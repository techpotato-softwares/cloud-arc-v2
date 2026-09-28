#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRODUCT="$ROOT/products/forgearc-ai"
RELEASES="$ROOT/releases"
VERSION="${1:-1.0.0}"
NAME="forgearc-ai-$VERSION"
TMP="$(mktemp -d)"
STAGE="$TMP/$NAME"
trap 'rm -rf "$TMP"' EXIT

uv --directory "$ROOT" run pytest products/forgearc-ai/apps/api/tests

mkdir -p "$STAGE" "$RELEASES"
rsync -a \
  --exclude '.env*' --exclude '.venv' --exclude '__pycache__' \
  --exclude '*.pyc' --exclude 'cdk.out' \
  --exclude '.pytest_cache' --exclude '.ruff_cache' --exclude '.DS_Store' \
  "$PRODUCT/" "$STAGE/"

cat > "$STAGE/pyproject.toml" <<EOF
[project]
name = "forgearc-ai"
version = "$VERSION"
description = "Standalone ForgeArc AI product"
requires-python = ">=3.12"
dependencies = ["forgearc-ai-api", "forgearc-ai-cdk"]

[tool.uv]
package = false

[tool.uv.sources]
forgearc-ai-api = { workspace = true }
forgearc-ai-cdk = { workspace = true }
forgearc-ai-core = { workspace = true }
forgearc-ai-aws = { workspace = true }

[tool.uv.workspace]
members = [
  "apps/api",
  "packages/core",
  "packages/aws_adapter",
  "infra/cdk",
]

[dependency-groups]
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "ruff>=0.5"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
pythonpath = ["apps/api/src", "packages/core/src", "packages/aws_adapter/src"]
EOF

(
  cd "$STAGE"
  uv lock
  uv sync --all-packages --frozen
  uv run --package forgearc-ai-api pytest apps/api/tests
)

rm -rf "$STAGE/.venv"
find "$STAGE" -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} +
find "$STAGE" -name '*.pyc' -delete
find "$STAGE" -exec touch -t 202001010000 {} +
rm -f "$RELEASES/$NAME.zip"
(
  cd "$TMP"
  find "$NAME" -type f -print | LC_ALL=C sort | zip -X -q "$RELEASES/$NAME.zip" -@
)
echo "$RELEASES/$NAME.zip"
