"""ForgeArc AI CDK app.

  cd products/forgearc-ai/infra/cdk
  pnpm dlx aws-cdk@2 synth AiStack-dev
"""

from __future__ import annotations

import os
import sys

from aws_cdk import App, Environment

sys.path.insert(0, os.path.dirname(__file__))

from stacks.ai_stack import AiStack

app = App()
account = os.environ.get("CDK_DEFAULT_ACCOUNT") or os.environ.get("AWS_ACCOUNT_ID")
region = os.environ.get("CDK_DEFAULT_REGION") or os.environ.get("AWS_REGION") or "us-east-1"
target = next((arg for arg in sys.argv if arg.startswith("AiStack-")), "AiStack-dev")
environment_name = target.removeprefix("AiStack-")
AiStack(app, target, environment_name=environment_name, env=Environment(account=account, region=region))
app.synth()
