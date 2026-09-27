#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PRODUCT="$ROOT/products/forgearc-node"
RELEASES="$ROOT/releases"
VERSION="${1:-$(node -p "require('$PRODUCT/package.json').version")}"
NAME="forgearc-node-$VERSION"
TMP="$(mktemp -d)"
STAGE="$TMP/$NAME"
trap 'rm -rf "$TMP"' EXIT

pnpm --dir "$PRODUCT" build
pnpm --dir "$PRODUCT" typecheck
pnpm --dir "$PRODUCT" test --runInBand

mkdir -p "$STAGE" "$RELEASES"
rsync -a \
  --exclude '.env*' --exclude 'node_modules' --exclude 'dist' \
  --exclude 'bundled' --exclude 'cdk.out' --exclude 'coverage' \
  --exclude '.turbo' --exclude '.DS_Store' \
  "$PRODUCT/" "$STAGE/"

cat > "$STAGE/pnpm-workspace.yaml" <<'EOF'
packages:
  - apps/*
  - packages/*
  - modules/*
  - infra/*
allowBuilds:
  '@prisma/client': true
  '@prisma/engines': true
  esbuild: true
  prisma: true
EOF

node - "$STAGE/package.json" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
pkg.packageManager = 'pnpm@11.0.9';
fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
NODE

(
  cd "$STAGE"
  pnpm install --lockfile-only
  pnpm install --frozen-lockfile
  pnpm typecheck
  pnpm test --runInBand
)

rm -rf "$STAGE/node_modules"
find "$STAGE" -type d -name node_modules -prune -exec rm -rf {} +
find "$STAGE" -exec touch -t 202001010000 {} +
rm -f "$RELEASES/$NAME.zip"
(
  cd "$TMP"
  find "$NAME" -type f -print | LC_ALL=C sort | zip -X -q "$RELEASES/$NAME.zip" -@
)
echo "$RELEASES/$NAME.zip"
