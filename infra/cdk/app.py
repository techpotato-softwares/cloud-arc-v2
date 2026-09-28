from __future__ import annotations

import json
import os
from pathlib import Path

import aws_cdk as cdk

from forgearc_dns_stack import ForgeArcDnsStack
from forgearc_platform_stack import ForgeArcPlatformStack

ROOT = Path(__file__).resolve().parents[2]
config = json.loads((Path(__file__).parent / "config.json").read_text())

app = cdk.App()
environment = cdk.Environment(
    account=os.environ.get("CDK_DEFAULT_ACCOUNT"),
    region=config["region"],
)
dns_stack = None
if config.get("customDomain") and not config.get("hostedZoneId"):
    dns_stack = ForgeArcDnsStack(
        app,
        f"{config['appName']}-dns-{config['stage']}",
        zone_name=config["hostedZoneName"],
        env=environment,
        description="ForgeArc public DNS zone",
    )

platform_stack = ForgeArcPlatformStack(
    app,
    f"{config['appName']}-{config['stage']}",
    root=ROOT,
    config=config,
    hosted_zone=dns_stack.zone if dns_stack else None,
    env=environment,
    description="ForgeArc production websites, commerce API, payments, fulfillment, and data",
)
if dns_stack:
    platform_stack.add_dependency(dns_stack)
app.synth()
