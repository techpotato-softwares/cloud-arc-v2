#!/usr/bin/env bash
# Build the portable image and smoke-test the API, worker, and migration command.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${FORGEARC_AI_IMAGE:-forgearc-ai:verify}"
PLATFORM="${FORGEARC_AI_PLATFORM:-}"
cd "$ROOT"

# Disable attached third-party SBOM attestations here so the subsequent Trivy
# scan inspects the image filesystem directly instead of trusting stale metadata.
build=(docker build --provenance=false -t "$IMAGE")
if [[ -n "$PLATFORM" ]]; then
  build+=(--platform "$PLATFORM")
fi
"${build[@]}" .

python_ok() {
  docker run --rm --read-only --tmpfs /tmp "$IMAGE" \
    python -c "$1"
}

python_ok "import forgearc_ai_api.app, forgearc_ai_api.sqs_worker, forgearc_ai_api.bootstrap"
python_ok "import alembic, psycopg, mangum"

name="forgearc-ai-smoke-$$"
docker rm -f "$name" >/dev/null 2>&1 || true
docker run -d --name "$name" --read-only --tmpfs /tmp \
  -p 127.0.0.1::8080 \
  -e FORGEARC_AI_ENVIRONMENT=local \
  -e FORGEARC_AI_CLOUD=local \
  -e JWT_SECRET=local-dev-secret \
  "$IMAGE" api >/dev/null
port="$(docker port "$name" 8080/tcp | awk -F: 'NR==1 { print $NF }')"
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

ready=0
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  if curl -fsS "http://127.0.0.1:${port}/health" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:${port}/ready" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 2
done
if [[ "$ready" != "1" ]]; then
  docker logs "$name" >&2 || true
  echo "API smoke test failed" >&2
  exit 1
fi

if command -v trivy >/dev/null 2>&1; then
  trivy image --exit-code 1 --severity HIGH,CRITICAL --ignore-unfixed \
    --ignorefile "$ROOT/.trivyignore" "$IMAGE"
else
  echo "trivy is not installed; image scan skipped"
fi

echo "ForgeArc AI image smoke test passed (${IMAGE})"
