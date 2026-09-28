#!/usr/bin/env bash
set -euo pipefail

if [[ "${FORGEARC_AWS_SMOKE:-}" != "1" ]]; then
  echo "AWS staging smoke is gated. Set FORGEARC_AWS_SMOKE=1 after the stack is deployed."
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
aws sts get-caller-identity >/dev/null
cd "$ROOT/infra/cdk"
pnpm dlx aws-cdk@2 synth AiStack-dev >/dev/null
echo "ForgeArc AI CDK stack synthesized."
