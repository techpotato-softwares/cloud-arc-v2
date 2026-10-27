#!/bin/sh
# Container commands: api, worker, migrate.
# API replicas do not migrate. Run migrate as a one-off task before rollout.
set -eu
cd /app
export FORGEARC_AI_CONFIG="${FORGEARC_AI_CONFIG:-/app/forgearc-ai.yaml}"
export PORT="${PORT:-8080}"
export PYTHONDONTWRITEBYTECODE=1
export PYTHONUNBUFFERED=1
export HOME="${HOME:-/tmp}"
export TMPDIR="${TMPDIR:-/tmp}"

eval "$(python -m forgearc_ai_api.bootstrap --export)"

command="${1:-api}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "$command" in
  api)
    exec python -m uvicorn forgearc_ai_api.app:app \
      --host 0.0.0.0 \
      --port "$PORT" \
      --proxy-headers \
      --forwarded-allow-ips='*' \
      --timeout-graceful-shutdown "${GRACEFUL_SHUTDOWN_SECONDS:-20}" \
      --limit-concurrency "${WEB_CONCURRENCY_LIMIT:-32}"
    ;;
  worker)
    exec python -m forgearc_ai_api.sqs_worker
    ;;
  migrate)
    exec alembic -c /app/migrations/alembic.ini upgrade head
    ;;
  *)
    exec "$command" "$@"
    ;;
esac
