#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
output="$root/.build/commerce-lambda"
requirements="$root/.build/commerce-requirements.txt"

rm -rf "$output"
mkdir -p "$output" "$root/.build"

uv export --package forgearc-commerce --no-dev --no-emit-project \
  --format requirements-txt --output-file "$requirements" --quiet >/dev/null
uv pip install --target "$output" --requirements "$requirements" \
  --python 3.12 --managed-python \
  --python-version 3.12 --python-platform aarch64-manylinux_2_28 \
  --only-binary=:all: --no-cache

cp -R "$root/services/commerce/app" "$output/app"
cp -R "$root/services/commerce/artifacts" "$output/artifacts"
cp "$root/packages/commercial-catalog/catalog.yaml" "$output/catalog.yaml"

find "$output" -type d -name '__pycache__' -prune -exec rm -rf {} +
find "$output" -type f \( -name '*.pyc' -o -name '*.pyo' \) -delete

echo "Commerce Lambda package: $output"
