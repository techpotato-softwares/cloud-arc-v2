#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/releases"
mkdir -p "$OUT"
STAGING=$(mktemp -d)
NAME="arcforge-python-$(date +%Y%m%d)"
cp -R "$ROOT/python-cloud-arc" "$STAGING/$NAME"
rm -rf "$STAGING/$NAME/.venv" 2>/dev/null || true
find "$STAGING/$NAME" -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
rm -rf "$STAGING/$NAME/layers/shared/python/bundled" 2>/dev/null || true
(cd "$STAGING" && zip -qr "$OUT/$NAME.zip" "$NAME")
rm -rf "$STAGING"
echo "Wrote $OUT/$NAME.zip"
