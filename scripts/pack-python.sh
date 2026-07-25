#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/releases"
mkdir -p "$OUT"
STAGING=$(mktemp -d)
NAME="arcforge-python-$(date +%Y%m%d)"
mkdir -p "$STAGING/$NAME"
cp -R "$ROOT/python" "$STAGING/$NAME/"
cp -R "$ROOT/docs" "$STAGING/$NAME/"
cp "$ROOT/LICENSE" "$ROOT/README.md" "$ROOT/docker-compose.yml" "$STAGING/$NAME/" 2>/dev/null || true
rm -rf "$STAGING/$NAME/python/.venv" "$STAGING/$NAME/python/**/__pycache__" \
  "$STAGING/$NAME/python/layers/shared/python/bundled" 2>/dev/null || true
find "$STAGING/$NAME" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
(cd "$STAGING" && zip -qr "$OUT/$NAME.zip" "$NAME")
rm -rf "$STAGING"
echo "Wrote $OUT/$NAME.zip"
