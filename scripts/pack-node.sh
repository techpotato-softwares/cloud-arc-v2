#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/releases"
mkdir -p "$OUT"
STAGING=$(mktemp -d)
NAME="arcforge-node-$(date +%Y%m%d)"
cp -R "$ROOT/node-cloud-arc" "$STAGING/$NAME"
rm -rf "$STAGING/$NAME/api/node_modules" "$STAGING/$NAME/api/dist" \
  "$STAGING/$NAME/api/layers/shared/nodejs/node_modules" \
  "$STAGING/$NAME/api/layers/shared/nodejs/bundled" \
  "$STAGING/$NAME/api/layers/shared/bundled" \
  "$STAGING/$NAME/cdk/cdk.out" "$STAGING/$NAME/cdk/node_modules" 2>/dev/null || true
rm -rf "$STAGING/$NAME/api/src/_legacy" 2>/dev/null || true
(cd "$STAGING" && zip -qr "$OUT/$NAME.zip" "$NAME")
rm -rf "$STAGING"
echo "Wrote $OUT/$NAME.zip"
