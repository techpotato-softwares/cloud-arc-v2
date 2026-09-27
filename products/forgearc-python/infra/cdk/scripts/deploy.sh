#!/usr/bin/env bash
# Build layer + synth/deploy ApiStack-{env}
set -euo pipefail
ENV="${1:-dev}"
CDK_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRODUCT_ROOT="$(cd "$CDK_ROOT/../.." && pwd)"
WORKSPACE_ROOT="$(cd "$PRODUCT_ROOT/../.." && pwd)"
API="$PRODUCT_ROOT/apps/api"

echo "==> Building Python Lambda layer"
uv --directory "$WORKSPACE_ROOT" run python "$PRODUCT_ROOT/packages/shared/scripts/build_layer.py"

echo "==> Generating app-manifest.json + OpenAPI"
uv --directory "$WORKSPACE_ROOT" run python "$API/scripts/generate_manifest.py"
uv --directory "$WORKSPACE_ROOT" run python "$API/scripts/generate_openapi.py"

ACTION="${2:-deploy}"
cd "$CDK_ROOT"
case "$ACTION" in
  synth) pnpm dlx aws-cdk@2 synth "ApiStack-$ENV" ;;
  deploy) pnpm dlx aws-cdk@2 deploy "ApiStack-$ENV" --require-approval never ;;
  diff) pnpm dlx aws-cdk@2 diff "ApiStack-$ENV" ;;
  destroy) pnpm dlx aws-cdk@2 destroy "ApiStack-$ENV" ;;
  *) echo "Usage: $0 [dev|qa|prod] [synth|deploy|diff|destroy]"; exit 1 ;;
esac
